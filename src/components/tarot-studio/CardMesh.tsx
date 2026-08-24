"use client";

import { RoundedBox, useTexture } from "@react-three/drei";
import { ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import {
  Suspense,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
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
import type {
  CardDefinition,
  CardSetDefinition,
  TableCard,
  TablePoint,
} from "@/types";
import type { SceneTableLayout } from "./table-layout";

const DRAG_PLANE = new Plane(new Vector3(0, 0, 1), 0);
const DRAG_THRESHOLD = 0.045;
const ROTATION_EDGE_THRESHOLD = 0.14;

export const CARD_THICKNESS = 0.11;

type PointerCaptureTarget = Mesh & {
  setPointerCapture?: (pointerId: number) => void;
  releasePointerCapture?: (pointerId: number) => void;
};

type DragState = {
  mode: "move" | "move-deck" | "rotate";
  pointerId: number;
  origin: Vector3;
  offset: Vector3;
  lastPoint: Vector3;
  moved: boolean;
  tiltX: number;
  tiltY: number;
  startAngle: number;
  startRotation: number;
  previewRotation: number;
};

type CardMeshProps = {
  card: TableCard;
  definition: CardDefinition;
  cardSet: CardSetDefinition;
  layout: SceneTableLayout;
  deckPosition: TablePoint;
  restingZ: number;
  selected: boolean;
  reducedMotion: boolean;
  onSelect: (cardId: string | null) => void;
  onDraw: (cardId: string, position: TablePoint) => void;
  onMoveDeck: (position: TablePoint) => void;
  onPreviewDeckPosition: (position: TablePoint | null) => void;
  onMove: (cardId: string, position: TablePoint) => void;
  onFlip: (cardId: string) => void;
  onRotate: (cardId: string, degrees: number) => void;
  onHover: (cardId: string | null) => void;
};

function useTextureForCard(url: string): Texture {
  const texture = useTexture(url);
  const gl = useThree((state) => state.gl);

  useLayoutEffect(() => {
    texture.colorSpace = SRGBColorSpace;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.generateMipmaps = false;
    texture.anisotropy = Math.min(4, gl.capabilities.getMaxAnisotropy());
    texture.needsUpdate = true;
  }, [gl, texture]);

  return texture;
}

export function CardArtwork({
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
      <meshBasicMaterial map={texture} toneMapped={false} />
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
  const outerInset = Math.min(0.2, cardWidth * 0.08);
  const ruleInset = Math.min(0.32, cardWidth * 0.13);
  const artInset = Math.min(0.42, cardWidth * 0.17);
  const fieldWidth = Math.max(0.2, cardWidth - outerInset);
  const fieldHeight = Math.max(0.3, cardHeight - outerInset);
  const ruleWidth = Math.max(0.18, cardWidth - ruleInset);
  const ruleHeight = Math.max(0.28, cardHeight - ruleInset);
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
      <Suspense fallback={null}>
        <CardArtwork
          url={artworkUrl}
          position={[0, 0, direction * (CARD_THICKNESS / 2 + 0.005)]}
          rotation={rotation}
          width={artworkWidth}
          height={artworkHeight}
        />
      </Suspense>
    </>
  );
}

function getPointerPoint(event: ThreeEvent<PointerEvent>): Vector3 {
  return event.ray.intersectPlane(DRAG_PLANE, new Vector3()) ?? event.point;
}

function isNearCardEdge(event: ThreeEvent<PointerEvent>): boolean {
  const uv = event.uv;

  if (!uv) {
    return false;
  }

  return (
    Math.min(uv.x, 1 - uv.x, uv.y, 1 - uv.y) <=
    ROTATION_EDGE_THRESHOLD
  );
}

export function CardMesh({
  card,
  definition,
  cardSet,
  layout,
  deckPosition,
  restingZ,
  selected,
  reducedMotion,
  onSelect,
  onDraw,
  onMoveDeck,
  onPreviewDeckPosition,
  onMove,
  onFlip,
  onRotate,
  onHover,
}: CardMeshProps) {
  const groupRef = useRef<Group>(null);
  const flipRef = useRef<Group>(null);
  const dragRef = useRef<DragState | null>(null);
  const [dragging, setDragging] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [hasRevealed, setHasRevealed] = useState(card.faceUp);
  const hasPositionedRef = useRef(false);
  const cardIdentityRef = useRef(card.id);
  const invalidate = useThree((state) => state.invalidate);
  const canvas = useThree((state) => state.gl.domElement);
  const targetPosition =
    card.zone === "deck" ? deckPosition : layout.toWorld(card.position);
  const cardWidth = layout.cardWidth;
  const cardHeight = layout.cardHeight;
  const frontTexture = definition.image.preview;

  useEffect(() => {
    if (card.faceUp) {
      setHasRevealed(true);
    }
  }, [card.faceUp]);

  useEffect(() => {
    if (card.zone === "table" && selected) {
      useTexture.preload(frontTexture);
    }
  }, [card.zone, frontTexture, selected]);

  useEffect(
    () => () => {
      canvas.style.cursor = "grab";
    },
    [canvas]
  );

  useLayoutEffect(() => {
    const group = groupRef.current;
    const cardChanged = cardIdentityRef.current !== card.id;

    if (!group || (hasPositionedRef.current && !cardChanged)) {
      return;
    }

    const initialPosition =
      card.zone === "table" ? deckPosition : targetPosition;

    group.position.set(initialPosition[0], initialPosition[1], restingZ);
    group.scale.set(1, 1, 1);
    hasPositionedRef.current = true;
    cardIdentityRef.current = card.id;
  }, [card.id, card.zone, deckPosition, restingZ, targetPosition]);

  useFrame((_, delta) => {
    const group = groupRef.current;
    const flippingCard = flipRef.current;

    if (!group || !flippingCard) {
      return;
    }

    const flipTarget = card.faceUp ? 0 : Math.PI;
    const drag = dragRef.current;
    const rotationDegrees =
      dragging && drag?.mode === "rotate"
        ? drag.previewRotation
        : card.rotation;
    const rotationTarget = MathUtils.degToRad(rotationDegrees);
    const tiltXTarget =
      dragging && drag?.mode === "move" ? drag.tiltX : 0;
    const tiltYTarget =
      dragging && drag?.mode === "move" ? drag.tiltY : 0;
    const lift = dragging
      ? drag?.mode === "move"
        ? 0.18
        : drag?.mode === "rotate"
          ? 0.035
          : 0.006
      : hovered
        ? 0.006
        : 0;
    const flipLift = reducedMotion
      ? 0
      : Math.abs(Math.sin(flippingCard.rotation.y)) * 0.1;
    const zTarget = restingZ + lift + flipLift;
    const positionXTarget = targetPosition[0];
    const positionYTarget = targetPosition[1];
    const scaleTarget = card.scale;

    if (reducedMotion) {
      flippingCard.rotation.y = flipTarget;
      group.rotation.x = 0;
      group.rotation.y = 0;
      group.rotation.z = rotationTarget;
      if (!dragging) {
        group.position.x = positionXTarget;
        group.position.y = positionYTarget;
      }
      group.position.z = zTarget;
      group.scale.set(scaleTarget, scaleTarget, 1);
      return;
    }

    const nextFlip = MathUtils.damp(
      flippingCard.rotation.y,
      flipTarget,
      10,
      delta
    );
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
    const nextScale = MathUtils.damp(
      group.scale.x,
      scaleTarget,
      12,
      delta
    );

    const needsAnotherFrame =
      Math.abs(nextFlip - flipTarget) > 0.0008 ||
      Math.abs(nextTiltX - tiltXTarget) > 0.0008 ||
      Math.abs(nextTiltY - tiltYTarget) > 0.0008 ||
      Math.abs(nextRotation - rotationTarget) > 0.0008 ||
      Math.abs(nextX - positionXTarget) > 0.0008 ||
      Math.abs(nextY - positionYTarget) > 0.0008 ||
      Math.abs(nextZ - zTarget) > 0.0008 ||
      Math.abs(nextScale - scaleTarget) > 0.0008;

    flippingCard.rotation.y = nextFlip;
    group.rotation.x = nextTiltX;
    group.rotation.y = nextTiltY;
    group.rotation.z = nextRotation;
    group.position.x = nextX;
    group.position.y = nextY;
    group.position.z = nextZ;
    group.scale.set(nextScale, nextScale, 1);

    if (needsAnotherFrame) {
      invalidate();
    }
  });

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    if (event.nativeEvent.button !== 0) {
      return;
    }

    event.stopPropagation();
    const point = getPointerPoint(event);
    const group = groupRef.current;
    const target = event.target as unknown as PointerCaptureTarget;

    if (!group) {
      return;
    }

    const movesDeck =
      card.zone === "deck" &&
      event.nativeEvent.pointerType !== "touch" &&
      (event.nativeEvent.ctrlKey || event.nativeEvent.metaKey);
    const mode: DragState["mode"] = movesDeck
      ? "move-deck"
      : card.zone === "table" &&
          selected &&
          event.nativeEvent.pointerType !== "touch" &&
          isNearCardEdge(event)
        ? "rotate"
        : "move";
    const startAngle = Math.atan2(
      point.y - group.position.y,
      point.x - group.position.x
    );

    target.setPointerCapture?.(event.pointerId);
    const pointerTarget = event.nativeEvent.target;

    if (pointerTarget instanceof HTMLElement) {
      pointerTarget.addEventListener(
        "lostpointercapture",
        (lostEvent) => {
          const activeDrag = dragRef.current;

          if (!activeDrag || activeDrag.pointerId !== lostEvent.pointerId) {
            return;
          }

          dragRef.current = null;
          if (activeDrag.mode === "move-deck") {
            onPreviewDeckPosition(null);
          }
          setDragging(false);
          canvas.style.cursor = "grab";
          invalidate();
        },
        { once: true }
      );
    }

    dragRef.current = {
      mode,
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
      startAngle,
      startRotation: card.rotation,
      previewRotation: card.rotation,
    };
    if (mode === "move-deck") {
      onPreviewDeckPosition([group.position.x, group.position.y]);
    }
    setDragging(true);
    canvas.style.cursor = mode === "rotate" ? "crosshair" : "grabbing";
    onSelect(mode === "move-deck" ? null : card.id);
    invalidate();
  };

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    const drag = dragRef.current;
    const group = groupRef.current;

    if (!group) {
      return;
    }

    if (!drag) {
      if (event.nativeEvent.pointerType !== "touch") {
        const deckMoveReady =
          card.zone === "deck" &&
          (event.nativeEvent.ctrlKey || event.nativeEvent.metaKey);
        const ready =
          card.zone === "table" && selected && isNearCardEdge(event);
        canvas.style.cursor = deckMoveReady
          ? "move"
          : ready
            ? "crosshair"
            : "grab";
      }

      return;
    }

    if (drag.pointerId !== event.pointerId) {
      return;
    }

    event.stopPropagation();
    const point = getPointerPoint(event);

    if (drag.mode === "rotate") {
      const pointerAngle = Math.atan2(
        point.y - group.position.y,
        point.x - group.position.x
      );
      let angleDelta = pointerAngle - drag.startAngle;

      if (angleDelta > Math.PI) {
        angleDelta -= Math.PI * 2;
      } else if (angleDelta < -Math.PI) {
        angleDelta += Math.PI * 2;
      }

      const rawRotation =
        drag.startRotation + MathUtils.radToDeg(angleDelta);
      const previewRotation = event.nativeEvent.shiftKey
        ? Math.round(rawRotation / 15) * 15
        : rawRotation;

      drag.previewRotation = previewRotation;
      drag.moved =
        Math.abs(previewRotation - drag.startRotation) > 0.8;
      drag.lastPoint.copy(point);
      group.rotation.z = MathUtils.degToRad(previewRotation);
      invalidate();
      return;
    }

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
    if (drag.mode === "move-deck") {
      onPreviewDeckPosition([nextX, nextY]);
    }
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
    dragRef.current = null;
    target.releasePointerCapture?.(event.pointerId);

    if (!cancelled) {
      if (drag.mode === "rotate" && drag.moved) {
        onRotate(
          card.id,
          drag.previewRotation - drag.startRotation
        );
      } else if (drag.mode !== "rotate" && drag.moved) {
        const point = getPointerPoint(event);
        const nextPoint = layout.toPoint(
          point.x - drag.offset.x,
          point.y - drag.offset.y
        );

        if (drag.mode === "move-deck") {
          onMoveDeck(nextPoint);
        } else if (card.zone === "deck") {
          onDraw(card.id, nextPoint);
        } else {
          onMove(card.id, nextPoint);
        }
      }
    }

    if (drag.mode === "move-deck") {
      onPreviewDeckPosition(null);
    }
    setDragging(false);
    canvas.style.cursor = "grab";
    invalidate();
  };

  const handleDoubleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();

    if (card.zone === "table") {
      onFlip(card.id);
    }
  };

  return (
    <group
      ref={groupRef}
      position={[targetPosition[0], targetPosition[1], restingZ]}
      rotation={[0, 0, MathUtils.degToRad(card.rotation)]}
    >
      <group ref={flipRef} rotation={[0, card.faceUp ? 0 : Math.PI, 0]}>
        <RoundedBox
          args={[cardWidth, cardHeight, CARD_THICKNESS]}
          radius={0.075}
          smoothness={5}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial
            color="#eee1c5"
            roughness={0.62}
            metalness={0.04}
          />
        </RoundedBox>
        {hasRevealed && (
          <CardFaceLayers
            artworkUrl={frontTexture}
            cardWidth={cardWidth}
            cardHeight={cardHeight}
          />
        )}
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
            event.stopPropagation();
            setHovered(true);
            onHover(card.zone === "table" ? card.id : null);
            const deckMoveReady =
              card.zone === "deck" &&
              (event.nativeEvent.ctrlKey || event.nativeEvent.metaKey);
            const ready =
              card.zone === "table" && selected && isNearCardEdge(event);
            canvas.style.cursor = deckMoveReady
              ? "move"
              : ready
                ? "crosshair"
                : "grab";
            invalidate();
          }
        }}
        onPointerOut={() => {
          setHovered(false);
          onHover(null);
          if (!dragRef.current) {
            canvas.style.cursor = "default";
          }
          invalidate();
        }}
        onContextMenu={(event) => {
          if (
            card.zone === "deck" &&
            (event.nativeEvent.ctrlKey || event.nativeEvent.metaKey)
          ) {
            event.stopPropagation();
            event.nativeEvent.preventDefault();
          }
        }}
        onDoubleClick={handleDoubleClick}
      >
        <planeGeometry args={[cardWidth, cardHeight]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}
