"use client";

import { RoundedBox, useTexture } from "@react-three/drei";
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
const CARD_THICKNESS = 0.13;

type PointerCaptureTarget = Mesh & {
  setPointerCapture?: (pointerId: number) => void;
  releasePointerCapture?: (pointerId: number) => void;
};

type DragState = {
  pointerId: number;
  origin: Vector3;
  offset: Vector3;
  lastPoint: Vector3;
  moved: boolean;
  tiltX: number;
  tiltY: number;
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

function CardFaceLayers({
  artworkUrl,
  cardWidth,
  cardHeight,
  reverse = false,
}: {
  artworkUrl: string;
  cardWidth: number;
  cardHeight: number;
  reverse?: boolean;
}) {
  const direction = reverse ? -1 : 1;
  const rotation: [number, number, number] | undefined = reverse
    ? [0, Math.PI, 0]
    : undefined;
  const outerInset = Math.min(0.1, cardWidth * 0.065);
  const artInset = Math.min(0.19, cardWidth * 0.12);
  const fieldWidth = Math.max(0.2, cardWidth - outerInset);
  const fieldHeight = Math.max(0.3, cardHeight - outerInset);
  const ruleWidth = Math.max(0.18, cardWidth - outerInset * 1.7);
  const ruleHeight = Math.max(0.28, cardHeight - outerInset * 1.7);
  const artworkWidth = Math.max(0.16, cardWidth - artInset);
  const artworkHeight = Math.max(0.26, cardHeight - artInset);

  return (
    <>
      <mesh
        position={[0, 0, direction * (CARD_THICKNESS / 2 + 0.001)]}
        rotation={rotation}
        receiveShadow
      >
        <planeGeometry args={[fieldWidth, fieldHeight]} />
        <meshStandardMaterial
          color="#162d29"
          roughness={0.52}
          metalness={0.12}
        />
      </mesh>
      <mesh
        position={[0, 0, direction * (CARD_THICKNESS / 2 + 0.003)]}
        rotation={rotation}
      >
        <planeGeometry args={[ruleWidth, ruleHeight]} />
        <meshStandardMaterial
          color="#a88042"
          roughness={0.46}
          metalness={0.48}
        />
      </mesh>
      <CardArtwork
        url={artworkUrl}
        position={[0, 0, direction * (CARD_THICKNESS / 2 + 0.005)]}
        rotation={rotation}
        width={artworkWidth}
        height={artworkHeight}
      />
    </>
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
  const hasPositionedRef = useRef(false);
  const cardIdentityRef = useRef(card.id);
  const invalidate = useThree((state) => state.invalidate);
  const targetPosition =
    card.zone === "deck" ? layout.deckPosition : layout.toWorld(card.position);
  const baseZ = card.zone === "deck" ? 0.035 : card.zIndex * 0.003;
  const cardWidth = layout.cardWidth * card.scale;
  const cardHeight = layout.cardHeight * card.scale;

  useLayoutEffect(() => {
    const group = groupRef.current;
    const cardChanged = cardIdentityRef.current !== card.id;

    if (!group || (hasPositionedRef.current && !cardChanged)) {
      return;
    }

    group.position.set(targetPosition[0], targetPosition[1], baseZ);
    hasPositionedRef.current = true;
    cardIdentityRef.current = card.id;
  }, [baseZ, card.id, targetPosition]);

  useFrame((_, delta) => {
    const group = groupRef.current;
    const faces = faceRef.current;

    if (!group || !faces) {
      return;
    }

    const flipTarget = card.faceUp ? 0 : Math.PI;
    const rotationTarget = MathUtils.degToRad(card.rotation);
    const drag = dragRef.current;
    const tiltXTarget = dragging ? drag?.tiltX ?? 0 : 0;
    const tiltYTarget = dragging ? drag?.tiltY ?? 0 : 0;
    const lift = dragging ? 0.25 : selected ? 0.12 : hovered ? 0.055 : 0;
    const flipLift = reducedMotion
      ? 0
      : Math.abs(Math.sin(faces.rotation.y)) * 0.072;
    const zTarget = baseZ + lift + flipLift;
    const positionXTarget = targetPosition[0];
    const positionYTarget = targetPosition[1];

    if (reducedMotion) {
      faces.rotation.y = flipTarget;
      group.rotation.x = 0;
      group.rotation.y = 0;
      group.rotation.z = rotationTarget;
      if (!dragging) {
        group.position.x = positionXTarget;
        group.position.y = positionYTarget;
      }
      group.position.z = zTarget;
      return;
    }

    const nextFlip = MathUtils.damp(faces.rotation.y, flipTarget, 16, delta);
    const nextTiltX = MathUtils.damp(group.rotation.x, tiltXTarget, 14, delta);
    const nextTiltY = MathUtils.damp(group.rotation.y, tiltYTarget, 14, delta);
    const nextRotation = MathUtils.damp(
      group.rotation.z,
      rotationTarget,
      14,
      delta
    );
    const nextX = dragging
      ? group.position.x
      : MathUtils.damp(group.position.x, positionXTarget, 15, delta);
    const nextY = dragging
      ? group.position.y
      : MathUtils.damp(group.position.y, positionYTarget, 15, delta);
    const nextZ = MathUtils.damp(group.position.z, zTarget, 18, delta);

    const needsAnotherFrame =
      Math.abs(nextFlip - flipTarget) > 0.0008 ||
      Math.abs(nextTiltX - tiltXTarget) > 0.0008 ||
      Math.abs(nextTiltY - tiltYTarget) > 0.0008 ||
      Math.abs(nextRotation - rotationTarget) > 0.0008 ||
      Math.abs(nextX - positionXTarget) > 0.0008 ||
      Math.abs(nextY - positionYTarget) > 0.0008 ||
      Math.abs(nextZ - zTarget) > 0.0008;

    faces.rotation.y = nextFlip;
    group.rotation.x = nextTiltX;
    group.rotation.y = nextTiltY;
    group.rotation.z = nextRotation;
    group.position.x = nextX;
    group.position.y = nextY;
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
      lastPoint: point.clone(),
      moved: false,
      tiltX: 0,
      tiltY: 0,
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
    const deltaX = point.x - drag.lastPoint.x;
    const deltaY = point.y - drag.lastPoint.y;

    if (point.distanceTo(drag.origin) > DRAG_THRESHOLD) {
      drag.moved = true;
    }

    drag.tiltX = MathUtils.clamp(-deltaY * 0.48, -0.13, 0.13);
    drag.tiltY = MathUtils.clamp(deltaX * 0.48, -0.13, 0.13);
    drag.lastPoint.copy(point);
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
      if (card.zone === "deck" && drag.moved) {
        onDraw(card.id, nextPoint);
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
        <mesh position={[0, 0, -CARD_THICKNESS / 2 - 0.008]} renderOrder={0}>
          <planeGeometry args={[cardWidth + 0.13, cardHeight + 0.13]} />
          <meshBasicMaterial
            color="#d7b66e"
            transparent
            opacity={0.42}
            depthWrite={false}
          />
        </mesh>
      )}
      <RoundedBox
        args={[cardWidth, cardHeight, CARD_THICKNESS]}
        radius={0.055}
        smoothness={4}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          color="#eee1c5"
          roughness={0.62}
          metalness={0.04}
        />
      </RoundedBox>
      <group
        ref={faceRef}
        rotation={[0, card.faceUp ? 0 : Math.PI, 0]}
      >
        <CardFaceLayers
          artworkUrl={frontTexture}
          cardWidth={cardWidth}
          cardHeight={cardHeight}
        />
        <CardFaceLayers
          artworkUrl={cardSet.back.preview}
          cardWidth={cardWidth}
          cardHeight={cardHeight}
          reverse
        />
      </group>
      <mesh
        position={[0, 0, CARD_THICKNESS / 2 + 0.04]}
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
