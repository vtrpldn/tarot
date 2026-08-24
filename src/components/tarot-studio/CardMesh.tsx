"use client";

import { useTexture } from "@react-three/drei";
import { ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Group,
  LinearFilter,
  MathUtils,
  Mesh,
  Plane,
  SRGBColorSpace,
  Texture,
  Vector3,
} from "three";
import type { CardDefinition, CardSetDefinition, TableCard, TablePoint } from "@/types";
import type { SceneTableLayout } from "./table-layout";

const DRAG_PLANE = new Plane(new Vector3(0, 0, 1), 0);
const DRAG_THRESHOLD = 0.045;

type PointerCaptureTarget = Mesh & {
  setPointerCapture?: (pointerId: number) => void;
  releasePointerCapture?: (pointerId: number) => void;
};

type DragState = {
  pointerId: number;
  origin: Vector3;
  offset: Vector3;
  moved: boolean;
};

type CardMeshProps = {
  card: TableCard;
  definition: CardDefinition;
  cardSet: CardSetDefinition;
  layout: SceneTableLayout;
  selected: boolean;
  reducedMotion: boolean;
  onSelect: (cardId: string | null) => void;
  onDraw: (cardId: string, position: TablePoint) => void;
  onMove: (cardId: string, position: TablePoint) => void;
  onFlip: (cardId: string) => void;
};

function useTextureForCard(url: string): Texture {
  const texture = useTexture(url);
  const gl = useThree((state) => state.gl);

  useEffect(() => {
    texture.colorSpace = SRGBColorSpace;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.generateMipmaps = false;
    texture.anisotropy = Math.min(4, gl.capabilities.getMaxAnisotropy());
    texture.needsUpdate = true;
  }, [gl, texture]);

  return texture;
}

function CardArtwork({
  url,
  position,
  rotation,
  width,
  height,
}: {
  url: string;
  position: [number, number, number];
  rotation?: [number, number, number];
  width: number;
  height: number;
}) {
  const texture = useTextureForCard(url);

  return (
    <mesh position={position} rotation={rotation} renderOrder={2}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial
        map={texture}
        transparent
        alphaTest={0.02}
        toneMapped={false}
      />
    </mesh>
  );
}

function getPointerPoint(event: ThreeEvent<PointerEvent>): Vector3 {
  return event.ray.intersectPlane(DRAG_PLANE, new Vector3()) ?? event.point;
}

export function CardMesh({
  card,
  definition,
  cardSet,
  layout,
  selected,
  reducedMotion,
  onSelect,
  onDraw,
  onMove,
  onFlip,
}: CardMeshProps) {
  const groupRef = useRef<Group>(null);
  const faceRef = useRef<Group>(null);
  const dragRef = useRef<DragState | null>(null);
  const [dragging, setDragging] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [hasRevealed, setHasRevealed] = useState(card.faceUp);
  const invalidate = useThree((state) => state.invalidate);
  const targetPosition =
    card.zone === "deck" ? layout.deckPosition : layout.toWorld(card.position);
  const baseZ = card.zone === "deck" ? 0.035 : card.zIndex * 0.003;
  const cardWidth = layout.cardWidth * card.scale;
  const cardHeight = layout.cardHeight * card.scale;

  useEffect(() => {
    if (card.faceUp) {
      setHasRevealed(true);
    }
  }, [card.faceUp]);

  useLayoutEffect(() => {
    if (!dragging && groupRef.current) {
      groupRef.current.position.x = targetPosition[0];
      groupRef.current.position.y = targetPosition[1];
    }
  }, [dragging, targetPosition]);

  useFrame((_, delta) => {
    const group = groupRef.current;
    const faces = faceRef.current;

    if (!group || !faces) {
      return;
    }

    const flipTarget = card.faceUp ? 0 : Math.PI;
    const rotationTarget = MathUtils.degToRad(card.rotation);
    const lift = selected || dragging ? 0.13 : hovered ? 0.045 : 0;
    const zTarget = baseZ + lift;

    if (reducedMotion) {
      faces.rotation.y = flipTarget;
      group.rotation.z = rotationTarget;
      group.position.z = zTarget;
      return;
    }

    const nextFlip = MathUtils.damp(faces.rotation.y, flipTarget, 16, delta);
    const nextRotation = MathUtils.damp(
      group.rotation.z,
      rotationTarget,
      14,
      delta
    );
    const nextZ = MathUtils.damp(group.position.z, zTarget, 18, delta);

    const needsAnotherFrame =
      Math.abs(nextFlip - flipTarget) > 0.0008 ||
      Math.abs(nextRotation - rotationTarget) > 0.0008 ||
      Math.abs(nextZ - zTarget) > 0.0008;

    faces.rotation.y = nextFlip;
    group.rotation.z = nextRotation;
    group.position.z = nextZ;

    if (needsAnotherFrame) {
      invalidate();
    }
  });

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    const point = getPointerPoint(event);
    const group = groupRef.current;
    const target = event.target as unknown as PointerCaptureTarget;

    if (!group) {
      return;
    }

    target.setPointerCapture?.(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      origin: point.clone(),
      offset: new Vector3(
        point.x - group.position.x,
        point.y - group.position.y,
        0
      ),
      moved: false,
    };
    setDragging(true);
    onSelect(card.id);
    invalidate();
  };

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    const drag = dragRef.current;
    const group = groupRef.current;

    if (!drag || drag.pointerId !== event.pointerId || !group) {
      return;
    }

    event.stopPropagation();
    const point = getPointerPoint(event);
    const nextX = point.x - drag.offset.x;
    const nextY = point.y - drag.offset.y;

    if (point.distanceTo(drag.origin) > DRAG_THRESHOLD) {
      drag.moved = true;
    }

    group.position.x = nextX;
    group.position.y = nextY;
    invalidate();
  };

  const finishDrag = (event: ThreeEvent<PointerEvent>, cancelled = false) => {
    const drag = dragRef.current;
    const group = groupRef.current;

    if (!drag || drag.pointerId !== event.pointerId || !group) {
      return;
    }

    event.stopPropagation();
    const target = event.target as unknown as PointerCaptureTarget;
    target.releasePointerCapture?.(event.pointerId);
    const point = getPointerPoint(event);
    const nextPoint = layout.toPoint(
      point.x - drag.offset.x,
      point.y - drag.offset.y
    );

    if (!cancelled) {
      if (card.zone === "deck") {
        onDraw(card.id, drag.moved ? nextPoint : layout.drawPoint);
      } else if (drag.moved) {
        onMove(card.id, nextPoint);
      }
    }

    dragRef.current = null;
    setDragging(false);
    invalidate();
  };

  const handleDoubleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();

    if (card.zone === "table") {
      onFlip(card.id);
    }
  };

  // Keep the Three.js texture cache bounded: the canvas only loads compact
  // artwork, while the higher-resolution variant remains available for a
  // future close-reading panel outside the WebGL texture cache.
  const frontTexture = definition.image.preview;

  return (
    <group
      ref={groupRef}
      position={[targetPosition[0], targetPosition[1], baseZ]}
      rotation={[0, 0, MathUtils.degToRad(card.rotation)]}
    >
      {selected && (
        <mesh position={[0, 0, -0.045]} renderOrder={0}>
          <planeGeometry args={[cardWidth + 0.13, cardHeight + 0.13]} />
          <meshBasicMaterial color="#d7b66e" />
        </mesh>
      )}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[cardWidth, cardHeight, 0.075]} />
        <meshStandardMaterial color="#f0e4cc" roughness={0.72} metalness={0.04} />
      </mesh>
      <group
        ref={faceRef}
        rotation={[0, card.faceUp ? 0 : Math.PI, 0]}
      >
        {hasRevealed && (
          <CardArtwork
            url={frontTexture}
            position={[0, 0, 0.041]}
            width={cardWidth}
            height={cardHeight}
          />
        )}
        <CardArtwork
          url={cardSet.back.preview}
          position={[0, 0, -0.041]}
          rotation={[0, Math.PI, 0]}
          width={cardWidth}
          height={cardHeight}
        />
      </group>
      <mesh
        position={[0, 0, 0.09]}
        renderOrder={10}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={(event) => finishDrag(event, true)}
        onPointerOver={(event) => {
          if (event.nativeEvent.pointerType !== "touch") {
            setHovered(true);
            invalidate();
          }
        }}
        onPointerOut={() => {
          setHovered(false);
          invalidate();
        }}
        onDoubleClick={handleDoubleClick}
      >
        <planeGeometry args={[cardWidth, cardHeight]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}
