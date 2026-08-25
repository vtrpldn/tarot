"use client";

import { useTexture } from "@react-three/drei";
import { ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import {
  memo,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ExtrudeGeometry,
  Group,
  LinearFilter,
  MathUtils,
  Mesh,
  Plane,
  Raycaster,
  Shape,
  SRGBColorSpace,
  Texture,
  Vector2,
  Vector3,
} from "three";
import type {
  CardDefinition,
  CardSetDefinition,
  TableCard,
  TablePoint,
} from "@/types";
import type { CardSoundPlayer } from "@/lib/card-sounds";
import type { SceneTableLayout } from "./table-layout";
import { TAROT_SCENE_PALETTE } from "./theme";

const DRAG_PLANE = new Plane(new Vector3(0, 0, 1), 0);
const DRAG_THRESHOLD = 0.045;
const ROTATION_EDGE_THRESHOLD = 0.14;
const DRAG_FOLLOW_LAMBDA = 21;
const POSITION_SETTLE_LAMBDA = 11;
const MAX_POINTER_SPEED = 7.5;
const RELEASE_GLIDE_SECONDS = 0.06;
const MAX_RELEASE_GLIDE = 0.32;
const MIN_THROW_SPEED = 0.7;
const MAX_THROW_ROTATION = 11;
const FLIP_DURATION_SECONDS = 0.52;
const FLIP_LIFT = 0.14;
const DRAG_SCALE = 1.035;

export const CARD_THICKNESS = 0.075;
const CARD_CORNER_RADIUS = 0.16;

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
  target: Vector3;
  velocity: Vector3;
  lastMoveAt: number;
  lastInputAt: number;
  moved: boolean;
  tiltX: number;
  tiltY: number;
  startAngle: number;
  startRotation: number;
  previewRotation: number;
};

type FlipAnimation = {
  from: number;
  to: number;
  elapsed: number;
};

type LostPointerCaptureBinding = {
  target: HTMLElement;
  handler: (event: PointerEvent) => void;
};

type PointerEndFallbackBinding = {
  target: Document;
  pointerId: number;
  pointerMoveHandler: (event: PointerEvent) => void;
  pointerUpHandler: (event: PointerEvent) => void;
  pointerCancelHandler: (event: PointerEvent) => void;
};

function sampleDragVelocity(
  drag: DragState,
  point: Vector3,
  timestamp: number
): [number, number] {
  const deltaX = point.x - drag.lastPoint.x;
  const deltaY = point.y - drag.lastPoint.y;
  const elapsed = Math.min(
    0.064,
    Math.max(0.004, (timestamp - drag.lastMoveAt) / 1000)
  );
  let sampleVelocityX = deltaX / elapsed;
  let sampleVelocityY = deltaY / elapsed;
  const sampleSpeed = Math.hypot(sampleVelocityX, sampleVelocityY);

  if (sampleSpeed > MAX_POINTER_SPEED) {
    const velocityScale = MAX_POINTER_SPEED / sampleSpeed;
    sampleVelocityX *= velocityScale;
    sampleVelocityY *= velocityScale;
  }

  if (Math.hypot(deltaX, deltaY) > 0.0001) {
    const velocityBlend = 1 - Math.exp(-elapsed * 18);
    drag.velocity.x = MathUtils.lerp(
      drag.velocity.x,
      sampleVelocityX,
      velocityBlend
    );
    drag.velocity.y = MathUtils.lerp(
      drag.velocity.y,
      sampleVelocityY,
      velocityBlend
    );
    drag.lastMoveAt = timestamp;
  }

  drag.lastPoint.copy(point);
  return [deltaX, deltaY];
}

type CardMeshProps = {
  card: TableCard;
  definition: CardDefinition;
  cardSet: CardSetDefinition;
  layout: SceneTableLayout;
  deckPosition: TablePoint;
  restingZ: number;
  interactionZ: number;
  draggingZ: number;
  renderOrder: number;
  dragRenderOrder: number;
  selected: boolean;
  reducedMotion: boolean;
  deckMoveMode: boolean;
  onSelect: (cardId: string | null) => void;
  onDraw: (
    cardId: string,
    position: TablePoint,
    rotation?: number
  ) => void;
  onMoveDeck: (position: TablePoint) => void;
  onPreviewDeckPosition: (position: TablePoint | null) => void;
  onMove: (
    cardId: string,
    position: TablePoint,
    rotation?: number
  ) => void;
  onFlip: (cardId: string) => void;
  onRotate: (cardId: string, degrees: number) => void;
  onHover: (cardId: string | null) => void;
  onSound: CardSoundPlayer;
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
  renderOrder = 3,
}: {
  url: string;
  position: [number, number, number];
  rotation?: [number, number, number];
  width: number;
  height: number;
  renderOrder?: number;
}) {
  const texture = useTextureForCard(url);

  return (
    <mesh
      position={position}
      rotation={rotation}
      renderOrder={renderOrder}
    >
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial
        map={texture}
        color="#fffdf7"
        roughness={0.92}
        metalness={0}
        toneMapped={false}
        depthTest={false}
        depthWrite={false}
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
  const frameInset = Math.min(0.34, cardWidth * 0.105);
  const artworkWidth = Math.max(0.16, cardWidth - frameInset);
  const artworkHeight = Math.max(0.26, cardHeight - frameInset);

  return (
    <Suspense fallback={null}>
      <CardArtwork
        url={artworkUrl}
        position={[0, 0, direction * (CARD_THICKNESS / 2 + 0.002)]}
        rotation={rotation}
        width={artworkWidth}
        height={artworkHeight}
        renderOrder={1}
      />
    </Suspense>
  );
}

function createCardSlabGeometry(width: number, height: number) {
  const radius = Math.min(
    CARD_CORNER_RADIUS,
    width * 0.08,
    height * 0.05
  );
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const shape = new Shape();

  shape.moveTo(-halfWidth + radius, -halfHeight);
  shape.lineTo(halfWidth - radius, -halfHeight);
  shape.quadraticCurveTo(
    halfWidth,
    -halfHeight,
    halfWidth,
    -halfHeight + radius
  );
  shape.lineTo(halfWidth, halfHeight - radius);
  shape.quadraticCurveTo(
    halfWidth,
    halfHeight,
    halfWidth - radius,
    halfHeight
  );
  shape.lineTo(-halfWidth + radius, halfHeight);
  shape.quadraticCurveTo(
    -halfWidth,
    halfHeight,
    -halfWidth,
    halfHeight - radius
  );
  shape.lineTo(-halfWidth, -halfHeight + radius);
  shape.quadraticCurveTo(
    -halfWidth,
    -halfHeight,
    -halfWidth + radius,
    -halfHeight
  );

  const geometry = new ExtrudeGeometry(shape, {
    bevelEnabled: false,
    curveSegments: 8,
    depth: CARD_THICKNESS,
    steps: 1,
  });

  geometry.translate(0, 0, -CARD_THICKNESS / 2);
  geometry.computeVertexNormals();
  return geometry;
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

function getThrownRotation({
  rotation,
  offset,
  velocityX,
  velocityY,
  cardWidth,
  cardHeight,
  reducedMotion,
}: {
  rotation: number;
  offset: Vector3;
  velocityX: number;
  velocityY: number;
  cardWidth: number;
  cardHeight: number;
  reducedMotion: boolean;
}): number {
  const speed = Math.hypot(velocityX, velocityY);

  if (reducedMotion || speed < MIN_THROW_SPEED) {
    return rotation;
  }

  const normalizedOffsetX = MathUtils.clamp(
    offset.x / (cardWidth / 2),
    -1,
    1
  );
  const normalizedOffsetY = MathUtils.clamp(
    offset.y / (cardHeight / 2),
    -1,
    1
  );
  const normalizedVelocityX = velocityX / MAX_POINTER_SPEED;
  const normalizedVelocityY = velocityY / MAX_POINTER_SPEED;
  const torque =
    normalizedOffsetX * normalizedVelocityY -
    normalizedOffsetY * normalizedVelocityX;
  const speedFactor = MathUtils.clamp(
    (speed - MIN_THROW_SPEED) / (MAX_POINTER_SPEED * 0.55),
    0,
    1
  );
  const rotationDelta = MathUtils.clamp(
    torque * 20 * speedFactor,
    -MAX_THROW_ROTATION,
    MAX_THROW_ROTATION
  );

  return rotation + rotationDelta;
}

export const CardMesh = memo(function CardMesh({
  card,
  definition,
  cardSet,
  layout,
  deckPosition,
  restingZ,
  interactionZ,
  draggingZ,
  renderOrder,
  dragRenderOrder,
  selected,
  reducedMotion,
  deckMoveMode,
  onSelect,
  onDraw,
  onMoveDeck,
  onPreviewDeckPosition,
  onMove,
  onFlip,
  onRotate,
  onHover,
  onSound,
}: CardMeshProps) {
  const groupRef = useRef<Group>(null);
  const flipRef = useRef<Group>(null);
  const slabRef = useRef<Mesh>(null);
  const dragRef = useRef<DragState | null>(null);
  const flipAnimationRef = useRef<FlipAnimation | null>(null);
  const pendingPositionRef = useRef<[number, number] | null>(null);
  const pendingRotationRef = useRef<number | null>(null);
  const pendingTopLayerRef = useRef(false);
  const pendingReconciliationTimeoutRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);
  const lostPointerCaptureRef =
    useRef<LostPointerCaptureBinding | null>(null);
  const pointerEndFallbackRef =
    useRef<PointerEndFallbackBinding | null>(null);
  const deckPreviewRef = useRef<TablePoint | null>(null);
  const [hasRevealed, setHasRevealed] = useState(card.faceUp);
  const hasPositionedRef = useRef(false);
  const cardIdentityRef = useRef(card.id);
  const invalidate = useThree((state) => state.invalidate);
  const canvas = useThree((state) => state.gl.domElement);
  const camera = useThree((state) => state.camera);
  const pointerRaycasterRef = useRef(new Raycaster());
  const pointerNdcRef = useRef(new Vector2());
  const targetPosition =
    card.zone === "deck" ? deckPosition : layout.toWorld(card.position);
  const targetPositionX = targetPosition[0];
  const targetPositionY = targetPosition[1];
  const cardWidth = layout.cardWidth;
  const cardHeight = layout.cardHeight;
  const slabGeometry = useMemo(
    () => createCardSlabGeometry(cardWidth, cardHeight),
    [cardHeight, cardWidth]
  );
  const frontTexture = definition.image.preview;

  useEffect(() => () => slabGeometry.dispose(), [slabGeometry]);

  const clearPendingReconciliationTimeout = useCallback(() => {
    if (pendingReconciliationTimeoutRef.current === null) {
      return;
    }

    clearTimeout(pendingReconciliationTimeoutRef.current);
    pendingReconciliationTimeoutRef.current = null;
  }, []);

  const clearPendingRelease = useCallback(() => {
    clearPendingReconciliationTimeout();
    pendingPositionRef.current = null;
    pendingRotationRef.current = null;
    pendingTopLayerRef.current = false;
    invalidate();
  }, [clearPendingReconciliationTimeout, invalidate]);

  const schedulePendingReconciliation = useCallback(() => {
    clearPendingReconciliationTimeout();
    pendingReconciliationTimeoutRef.current = setTimeout(() => {
      pendingReconciliationTimeoutRef.current = null;
      pendingPositionRef.current = null;
      pendingRotationRef.current = null;
      pendingTopLayerRef.current = false;
      invalidate();
    }, 700);
  }, [clearPendingReconciliationTimeout, invalidate]);

  const clearLostPointerCapture = useCallback(() => {
    const binding = lostPointerCaptureRef.current;

    if (!binding) {
      return;
    }

    binding.target.removeEventListener(
      "lostpointercapture",
      binding.handler
    );
    lostPointerCaptureRef.current = null;
  }, []);

  const clearPointerEndFallback = useCallback(() => {
    const binding = pointerEndFallbackRef.current;

    if (!binding) {
      return;
    }

    binding.target.removeEventListener(
      "pointermove",
      binding.pointerMoveHandler
    );
    binding.target.removeEventListener("pointerup", binding.pointerUpHandler);
    binding.target.removeEventListener(
      "pointercancel",
      binding.pointerCancelHandler
    );
    pointerEndFallbackRef.current = null;
  }, []);

  const getCanvasPointerPoint = useCallback(
    (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect();
      const pointer = pointerNdcRef.current;

      pointer.set(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        -((event.clientY - bounds.top) / bounds.height) * 2 + 1
      );
      pointerRaycasterRef.current.setFromCamera(pointer, camera);

      return (
        pointerRaycasterRef.current.ray.intersectPlane(
          DRAG_PLANE,
          new Vector3()
        ) ?? dragRef.current?.lastPoint.clone() ?? new Vector3()
      );
    },
    [camera, canvas]
  );

  const setDeckPreview = useCallback(
    (position: TablePoint | null) => {
      const current = deckPreviewRef.current;
      const unchanged =
        current === position ||
        (current !== null &&
          position !== null &&
          Math.abs(current[0] - position[0]) <= 0.0005 &&
          Math.abs(current[1] - position[1]) <= 0.0005);

      if (unchanged) {
        return;
      }

      deckPreviewRef.current = position;
      onPreviewDeckPosition(position);
    },
    [onPreviewDeckPosition]
  );

  useEffect(() => {
    if (card.faceUp) {
      setHasRevealed(true);
      useTexture.preload(frontTexture);
    }

    invalidate();
  }, [card.faceUp, frontTexture, invalidate]);

  useEffect(() => {
    if (card.zone === "table" && selected) {
      useTexture.preload(frontTexture);
    }
  }, [card.zone, frontTexture, selected]);

  useEffect(
    () => () => {
      dragRef.current = null;
      flipAnimationRef.current = null;
      pendingPositionRef.current = null;
      pendingRotationRef.current = null;
      pendingTopLayerRef.current = false;
      clearPendingReconciliationTimeout();
      clearLostPointerCapture();
      clearPointerEndFallback();
      setDeckPreview(null);
      canvas.style.cursor = "grab";
    },
    [
      canvas,
      clearLostPointerCapture,
      clearPointerEndFallback,
      clearPendingReconciliationTimeout,
      setDeckPreview,
    ]
  );

  useLayoutEffect(() => {
    const group = groupRef.current;
    const cardChanged = cardIdentityRef.current !== card.id;

    const flippingCard = flipRef.current;

    if (
      !group ||
      !flippingCard ||
      (hasPositionedRef.current && !cardChanged)
    ) {
      return;
    }

    const initialPosition =
      card.zone === "table" ? deckPosition : targetPosition;

    group.position.set(initialPosition[0], initialPosition[1], restingZ);
    group.rotation.set(0, 0, 0);
    group.scale.set(1, 1, 1);
    flippingCard.rotation.set(0, card.faceUp ? 0 : Math.PI, 0);
    flipAnimationRef.current = null;
    hasPositionedRef.current = true;
    cardIdentityRef.current = card.id;
  }, [card.faceUp, card.id, card.zone, deckPosition, restingZ, targetPosition]);

  useEffect(() => {
    const flippingCard = flipRef.current;

    if (!flippingCard) {
      return;
    }

    const target = card.faceUp ? 0 : Math.PI;

    if (reducedMotion) {
      flippingCard.rotation.set(0, target, 0);
      flipAnimationRef.current = null;
      invalidate();
      return;
    }

    if (Math.abs(flippingCard.rotation.y - target) <= 0.0008) {
      return;
    }

    flipAnimationRef.current = {
      from: flippingCard.rotation.y,
      to: target,
      elapsed: 0,
    };
    invalidate();
  }, [card.faceUp, invalidate, reducedMotion]);

  useEffect(() => {
    const pendingPosition = pendingPositionRef.current;
    const pendingRotation = pendingRotationRef.current;

    if (
      pendingPosition &&
      Math.abs(pendingPosition[0] - targetPositionX) <= 0.0005 &&
      Math.abs(pendingPosition[1] - targetPositionY) <= 0.0005
    ) {
      pendingPositionRef.current = null;
    }

    if (
      pendingRotation !== null &&
      Math.abs(pendingRotation - card.rotation) <= 0.0005
    ) {
      pendingRotationRef.current = null;
    }

    if (
      pendingPositionRef.current === null &&
      pendingRotationRef.current === null
    ) {
      pendingTopLayerRef.current = false;
      clearPendingReconciliationTimeout();
    }
    invalidate();
  }, [
    card.rotation,
    card.zIndex,
    card.zone,
    clearPendingReconciliationTimeout,
    invalidate,
    targetPositionX,
    targetPositionY,
  ]);

  const updateDrag = useCallback(
    ({
      pointerId,
      point,
      timestamp,
      shiftKey = false,
    }: {
      pointerId: number;
      point: Vector3;
      timestamp: number;
      shiftKey?: boolean;
    }) => {
      const drag = dragRef.current;
      const group = groupRef.current;

      if (!drag || drag.pointerId !== pointerId || !group) {
        return false;
      }

      // Both React Three Fiber and the canvas fallback see the same DOM event.
      // Process it once while still accepting movement that no longer raycasts
      // against the card after a very fast pointer motion.
      if (
        drag.lastInputAt === timestamp &&
        point.distanceToSquared(drag.lastPoint) <= 0.00000001
      ) {
        return true;
      }

      drag.lastInputAt = timestamp;

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
        const previewRotation = shiftKey
          ? Math.round(rawRotation / 15) * 15
          : rawRotation;

        drag.previewRotation = previewRotation;
        drag.moved =
          Math.abs(previewRotation - drag.startRotation) > 0.8;

        if (drag.moved) {
          onSound("rotate", {
            intensity: MathUtils.clamp(
              0.32 +
                Math.abs(previewRotation - drag.startRotation) / 120,
              0.32,
              0.75
            ),
          });
        }

        drag.lastPoint.copy(point);
        invalidate();
        return true;
      }

      const nextX = point.x - drag.offset.x;
      const nextY = point.y - drag.offset.y;
      const [deltaX, deltaY] = sampleDragVelocity(drag, point, timestamp);

      if (point.distanceTo(drag.origin) > DRAG_THRESHOLD) {
        drag.moved = true;
      }

      if (drag.moved && Math.hypot(deltaX, deltaY) > 0.003) {
        const dragSpeed = Math.hypot(drag.velocity.x, drag.velocity.y);

        onSound("move", {
          intensity: MathUtils.clamp(
            0.25 + (dragSpeed / MAX_POINTER_SPEED) * 0.28,
            0.25,
            0.53
          ),
        });
      }

      drag.tiltX = MathUtils.clamp(-deltaY * 0.48, -0.13, 0.13);
      drag.tiltY = MathUtils.clamp(deltaX * 0.48, -0.13, 0.13);
      drag.target.set(nextX, nextY, group.position.z);
      invalidate();
      return true;
    },
    [invalidate, onSound]
  );

  const finishDragAt = useCallback(
    ({
      pointerId,
      point,
      timestamp,
      cancelled = false,
    }: {
      pointerId: number;
      point: Vector3;
      timestamp: number;
      cancelled?: boolean;
    }) => {
      const drag = dragRef.current;
      const group = groupRef.current;

      if (!drag || drag.pointerId !== pointerId || !group) {
        return false;
      }

      if (!cancelled) {
        updateDrag({ pointerId, point, timestamp });
      }

      if (!cancelled) {
        if (drag.mode === "rotate" && drag.moved) {
          pendingRotationRef.current = drag.previewRotation;
          schedulePendingReconciliation();
          onRotate(card.id, drag.previewRotation - drag.startRotation);
        } else if (drag.mode !== "rotate" && drag.moved) {
          const releaseX = point.x - drag.offset.x;
          const releaseY = point.y - drag.offset.y;
          drag.target.set(releaseX, releaseY, group.position.z);
          const idleSeconds = Math.max(
            0,
            (timestamp - drag.lastMoveAt) / 1000
          );
          const velocityDecay = reducedMotion
            ? 0
            : Math.exp(-idleSeconds * 10);
          const releaseVelocityX = drag.velocity.x * velocityDecay;
          const releaseVelocityY = drag.velocity.y * velocityDecay;
          let glideX = releaseVelocityX * RELEASE_GLIDE_SECONDS;
          let glideY = releaseVelocityY * RELEASE_GLIDE_SECONDS;
          const glideDistance = Math.hypot(glideX, glideY);

          if (glideDistance > MAX_RELEASE_GLIDE) {
            const glideScale = MAX_RELEASE_GLIDE / glideDistance;
            glideX *= glideScale;
            glideY *= glideScale;
          }

          const nextPoint = layout.toPoint(
            releaseX + glideX,
            releaseY + glideY
          );
          const nextWorldPosition = layout.toWorld(nextPoint);

          if (drag.mode === "move-deck") {
            pendingPositionRef.current = nextWorldPosition;
            schedulePendingReconciliation();
            onMoveDeck(nextPoint);
          } else {
            const landingRotation = getThrownRotation({
              rotation: card.rotation,
              offset: drag.offset,
              velocityX: releaseVelocityX,
              velocityY: releaseVelocityY,
              cardWidth,
              cardHeight,
              reducedMotion,
            });

            pendingPositionRef.current = nextWorldPosition;
            pendingRotationRef.current = landingRotation;
            pendingTopLayerRef.current = true;
            schedulePendingReconciliation();

            if (card.zone === "deck") {
              onDraw(card.id, nextPoint, landingRotation);
            } else {
              onMove(card.id, nextPoint, landingRotation);
            }
          }
        }
      }

      if (cancelled) {
        clearPendingRelease();
        onHover(null);
      }

      dragRef.current = null;

      if (drag.mode === "move-deck") {
        setDeckPreview(null);
      }
      canvas.style.cursor = "grab";
      invalidate();
      return true;
    },
    [
      canvas,
      card.id,
      card.rotation,
      card.zone,
      cardHeight,
      cardWidth,
      clearPendingRelease,
      invalidate,
      layout,
      onDraw,
      onHover,
      onMove,
      onMoveDeck,
      onRotate,
      reducedMotion,
      schedulePendingReconciliation,
      setDeckPreview,
      updateDrag,
    ]
  );

  useFrame((_, delta) => {
    const group = groupRef.current;
    const flippingCard = flipRef.current;
    const slab = slabRef.current;

    if (!group || !flippingCard) {
      return;
    }

    const drag = dragRef.current;
    const pendingPosition = pendingPositionRef.current;
    const pendingRotation = pendingRotationRef.current;
    const rendersOnTop = Boolean(drag?.moved) || pendingTopLayerRef.current;
    const activeRenderOrder = rendersOnTop
      ? dragRenderOrder
      : renderOrder;
    group.renderOrder = activeRenderOrder;
    flippingCard.renderOrder = activeRenderOrder;
    const moving = drag && drag.mode !== "rotate";
    const rotationDegrees =
      drag?.mode === "rotate"
        ? drag.previewRotation
        : pendingRotation ?? card.rotation;
    const rotationTarget = MathUtils.degToRad(rotationDegrees);
    const tiltXTarget =
      drag?.mode === "move" ? drag.tiltX : 0;
    const tiltYTarget =
      drag?.mode === "move" ? drag.tiltY : 0;
    const scaleTarget = drag?.mode === "move" && drag.moved ? DRAG_SCALE : 1;
    const flipAnimation = flipAnimationRef.current;
    let flipIsActive = false;

    if (reducedMotion) {
      flippingCard.rotation.set(0, card.faceUp ? 0 : Math.PI, 0);
      flipAnimationRef.current = null;
    } else if (flipAnimation) {
      flipAnimation.elapsed = Math.min(
        FLIP_DURATION_SECONDS,
        flipAnimation.elapsed + Math.min(delta, 1 / 30)
      );
      const progress = flipAnimation.elapsed / FLIP_DURATION_SECONDS;
      const easedProgress =
        progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      flippingCard.rotation.y = MathUtils.lerp(
        flipAnimation.from,
        flipAnimation.to,
        easedProgress
      );
      flippingCard.rotation.x = Math.sin(Math.PI * progress) * 0.025;
      flipIsActive = progress < 1;

      if (!flipIsActive) {
        flippingCard.rotation.set(0, flipAnimation.to, 0);
        flipAnimationRef.current = null;
      }
    }

    // Face layers use painter ordering rather than physical depth. Keeping
    // them out of the shadow pass prevents another card's shadow from reading
    // as transparency, while the slab still gives placed cards a stable shadow.
    if (slab) {
      slab.castShadow = !flipIsActive;
    }

    const flipLift =
      reducedMotion || !flipIsActive
        ? 0
        : Math.abs(Math.sin(flippingCard.rotation.y)) * FLIP_LIFT;
    const zTarget =
      drag?.moved && drag.mode !== "move-deck"
        ? draggingZ + flipLift
        : restingZ + (drag?.mode === "move-deck" ? 0.006 : 0) + flipLift;
    const positionXTarget = moving
      ? drag.target.x
      : pendingPosition?.[0] ?? targetPositionX;
    const positionYTarget = moving
      ? drag.target.y
      : pendingPosition?.[1] ?? targetPositionY;

    if (reducedMotion) {
      group.rotation.x = 0;
      group.rotation.y = 0;
      group.rotation.z = rotationTarget;
      group.position.x = positionXTarget;
      group.position.y = positionYTarget;
      group.position.z = zTarget;
      group.scale.set(scaleTarget, scaleTarget, scaleTarget);
      if (drag?.mode === "move-deck") {
        setDeckPreview([positionXTarget, positionYTarget]);
      }
      return;
    }

    const nextTiltX = MathUtils.damp(group.rotation.x, tiltXTarget, 14, delta);
    const nextTiltY = MathUtils.damp(group.rotation.y, tiltYTarget, 14, delta);
    const nextRotation = MathUtils.damp(
      group.rotation.z,
      rotationTarget,
      14,
      delta
    );
    const positionLambda = moving
      ? DRAG_FOLLOW_LAMBDA
      : POSITION_SETTLE_LAMBDA;
    const nextX = MathUtils.damp(
      group.position.x,
      positionXTarget,
      positionLambda,
      delta
    );
    const nextY = MathUtils.damp(
      group.position.y,
      positionYTarget,
      positionLambda,
      delta
    );
    const nextZ = MathUtils.damp(group.position.z, zTarget, 18, delta);
    const nextScale = MathUtils.damp(
      group.scale.x,
      scaleTarget,
      17,
      delta
    );

    const needsAnotherFrame =
      flipIsActive ||
      Math.abs(nextTiltX - tiltXTarget) > 0.0008 ||
      Math.abs(nextTiltY - tiltYTarget) > 0.0008 ||
      Math.abs(nextRotation - rotationTarget) > 0.0008 ||
      Math.abs(nextX - positionXTarget) > 0.0008 ||
      Math.abs(nextY - positionYTarget) > 0.0008 ||
      Math.abs(nextZ - zTarget) > 0.0008 ||
      Math.abs(nextScale - scaleTarget) > 0.0008;

    group.rotation.x = nextTiltX;
    group.rotation.y = nextTiltY;
    group.rotation.z = nextRotation;
    group.position.x = nextX;
    group.position.y = nextY;
    group.position.z = nextZ;
    group.scale.set(nextScale, nextScale, nextScale);

    if (drag?.mode === "move-deck") {
      setDeckPreview([nextX, nextY]);
    }

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
      (deckMoveMode ||
        (event.nativeEvent.pointerType !== "touch" &&
          (event.nativeEvent.ctrlKey || event.nativeEvent.metaKey)));
    const mode: DragState["mode"] = movesDeck
      ? "move-deck"
      : card.zone === "table" &&
          selected &&
          event.nativeEvent.pointerType !== "touch" &&
          isNearCardEdge(event)
        ? "rotate"
        : "move";

    if (!card.faceUp && mode === "move") {
      useTexture.preload(frontTexture);
    }
    const startAngle = Math.atan2(
      point.y - group.position.y,
      point.x - group.position.x
    );

    target.setPointerCapture?.(event.pointerId);
    canvas.setPointerCapture?.(event.pointerId);

    clearLostPointerCapture();
    clearPointerEndFallback();
    if (typeof canvas.setPointerCapture === "function") {
      const handleLostPointerCapture = (lostEvent: PointerEvent) => {
        lostPointerCaptureRef.current = null;
        const activeDrag = dragRef.current;

        if (!activeDrag || activeDrag.pointerId !== lostEvent.pointerId) {
          return;
        }

        clearPointerEndFallback();
        finishDragAt({
          pointerId: lostEvent.pointerId,
          point: activeDrag.lastPoint.clone(),
          timestamp: lostEvent.timeStamp,
        });
      };

      canvas.addEventListener(
        "lostpointercapture",
        handleLostPointerCapture,
        { once: true }
      );
      lostPointerCaptureRef.current = {
        target: canvas,
        handler: handleLostPointerCapture,
      };
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
      target: group.position.clone(),
      velocity: new Vector3(),
      lastMoveAt: event.timeStamp,
      lastInputAt: event.timeStamp,
      moved: false,
      tiltX: 0,
      tiltY: 0,
      startAngle,
      startRotation: card.rotation,
      previewRotation: card.rotation,
    };
    onSound("pickup");
    if (mode === "move-deck") {
      setDeckPreview([group.position.x, group.position.y]);
    }

    const handlePointerMoveFallback = (nativeEvent: PointerEvent) => {
      if (nativeEvent.pointerId !== event.pointerId) {
        return;
      }

      updateDrag({
        pointerId: nativeEvent.pointerId,
        point: getCanvasPointerPoint(nativeEvent),
        timestamp: nativeEvent.timeStamp,
        shiftKey: nativeEvent.shiftKey,
      });
    };
    const handlePointerUpFallback = (nativeEvent: PointerEvent) => {
      if (nativeEvent.pointerId !== event.pointerId) {
        return;
      }

      clearLostPointerCapture();
      clearPointerEndFallback();
      if (canvas.hasPointerCapture(nativeEvent.pointerId)) {
        canvas.releasePointerCapture(nativeEvent.pointerId);
      }
      finishDragAt({
        pointerId: nativeEvent.pointerId,
        point: getCanvasPointerPoint(nativeEvent),
        timestamp: nativeEvent.timeStamp,
      });
    };
    const handlePointerCancelFallback = (nativeEvent: PointerEvent) => {
      if (nativeEvent.pointerId !== event.pointerId) {
        return;
      }

      clearLostPointerCapture();
      clearPointerEndFallback();
      if (canvas.hasPointerCapture(nativeEvent.pointerId)) {
        canvas.releasePointerCapture(nativeEvent.pointerId);
      }
      finishDragAt({
        pointerId: nativeEvent.pointerId,
        point: getCanvasPointerPoint(nativeEvent),
        timestamp: nativeEvent.timeStamp,
        cancelled: true,
      });
    };

    document.addEventListener("pointermove", handlePointerMoveFallback);
    document.addEventListener("pointerup", handlePointerUpFallback);
    document.addEventListener("pointercancel", handlePointerCancelFallback);
    pointerEndFallbackRef.current = {
      target: document,
      pointerId: event.pointerId,
      pointerMoveHandler: handlePointerMoveFallback,
      pointerUpHandler: handlePointerUpFallback,
      pointerCancelHandler: handlePointerCancelFallback,
    };
    canvas.style.cursor = mode === "rotate" ? "crosshair" : "grabbing";
    onSelect(
      mode !== "move-deck" && card.zone === "table" ? card.id : null
    );
    invalidate();
  };

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    const drag = dragRef.current;

    if (!drag) {
      if (event.nativeEvent.pointerType !== "touch") {
        const deckMoveReady =
          card.zone === "deck" &&
          (deckMoveMode ||
            event.nativeEvent.ctrlKey ||
            event.nativeEvent.metaKey);
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
    updateDrag({
      pointerId: event.pointerId,
      point: getPointerPoint(event),
      timestamp: event.timeStamp,
      shiftKey: event.nativeEvent.shiftKey,
    });
  };

  const finishDrag = (event: ThreeEvent<PointerEvent>, cancelled = false) => {
    event.stopPropagation();
    const target = event.target as unknown as PointerCaptureTarget;
    clearLostPointerCapture();
    clearPointerEndFallback();
    target.releasePointerCapture?.(event.pointerId);
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
    finishDragAt({
      pointerId: event.pointerId,
      point: getPointerPoint(event),
      timestamp: event.timeStamp,
      cancelled,
    });
  };

  const handleDoubleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();

    if (card.zone === "table" || card.zone === "deck") {
      onFlip(card.id);
    }
  };

  return (
    <group ref={groupRef} renderOrder={renderOrder}>
      <group ref={flipRef} renderOrder={renderOrder}>
        <mesh
          ref={slabRef}
          geometry={slabGeometry}
          castShadow
          receiveShadow
          renderOrder={0}
        >
          <meshStandardMaterial
            color={TAROT_SCENE_PALETTE.cardPaper}
            roughness={0.96}
            metalness={0}
            depthTest={false}
            depthWrite={false}
          />
        </mesh>
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
        position={[0, 0, interactionZ - restingZ]}
        renderOrder={4}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={(event) => finishDrag(event, true)}
        onPointerOver={(event) => {
          if (event.nativeEvent.pointerType !== "touch") {
            event.stopPropagation();
            onHover(card.zone === "table" ? card.id : null);
            const deckMoveReady =
              card.zone === "deck" &&
              (deckMoveMode ||
                event.nativeEvent.ctrlKey ||
                event.nativeEvent.metaKey);
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
        <meshBasicMaterial
          transparent
          opacity={0}
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
});
