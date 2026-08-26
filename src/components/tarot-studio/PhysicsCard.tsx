"use client";

import {
  CuboidCollider,
  RigidBody,
  type RapierRigidBody,
  useBeforePhysicsStep,
  useRapier,
} from "@react-three/rapier";
import { type ThreeEvent, useThree } from "@react-three/fiber";
import {
  type MutableRefObject,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import {
  DoubleSide,
  type ExtrudeGeometry,
  Group,
  MathUtils,
  Mesh,
  Plane,
  Raycaster,
  Vector2,
  Vector3,
} from "three";
import type {
  CardArtworkCrop,
  CardDefinition,
  CardSetDefinition,
  TableCard,
  TablePoint,
} from "@/types";
import type { CardSoundPlayer } from "@/lib/card-sounds";
import {
  CARD_PHYSICS,
  clampPhysicsPointToBounds,
  constrainReleaseToBounds,
  createCardQuaternion,
  getCardColliderHalfExtents,
  getCardPose,
  getFlipVisualState,
  getReleaseKinematics,
  hasMeaningfulPoseChange,
  isPhysicsLaunchForTarget,
  type PhysicsCardLaunch,
  type PhysicsCardPose,
  type PhysicsTableBounds,
} from "@/lib/card-physics";
import {
  CARD_THICKNESS,
  CardArtwork,
  type ExternalCardDrag,
} from "./CardMesh";
import { CardPaperMaterial, getPaperSeed } from "./CardPaperMaterial";
import { TAROT_SCENE_PALETTE } from "./theme";

const CARD_FACE_PLANE_OFFSET = 0.002;
const CARD_VISIBLE_HALF_DEPTH = CARD_THICKNESS / 2 + CARD_FACE_PLANE_OFFSET;
const DRAG_THRESHOLD = 0.035;
const ROTATION_EDGE_THRESHOLD = 0.14;
const MAX_POINTER_SPEED = 8;

type PointerCaptureTarget = Mesh & {
  releasePointerCapture?: (pointerId: number) => void;
  setPointerCapture?: (pointerId: number) => void;
};

type DragMode = "move" | "rotate";

type DragState = {
  mode: DragMode;
  pointerId: number;
  grabOffset: Vector3;
  origin: Vector3;
  lastPoint: Vector3;
  lastInputTimestamp: number;
  lastMovementTimestamp: number;
  lastTimestamp: number;
  pointerVelocity: Vector3;
  target: Vector3;
  startAngle: number;
  startRotation: number;
  previewRotation: number;
  startQuaternion: { w: number; x: number; y: number; z: number };
  startTranslation: Vector3;
  moved: boolean;
};

type PointerFallbackBinding = {
  pointerCancelHandler: (event: PointerEvent) => void;
  pointerMoveHandler: (event: PointerEvent) => void;
  pointerUpHandler: (event: PointerEvent) => void;
};

type LostPointerCaptureBinding = {
  handler: (event: PointerEvent) => void;
  target: HTMLCanvasElement;
};

type FlipState = {
  elapsed: number;
  position: Vector3;
  rotation: { w: number; x: number; y: number; z: number };
};

const FLIP_DURATION_SECONDS = 0.42;

/**
 * Runtime props for a table card that remains dynamic after a pointer release.
 */
export type PhysicsCardProps = {
  /** Durable pose revision used to reject stale solver output. */
  authorityKey: string;
  card: TableCard;
  cardSet: CardSetDefinition;
  cardWidth: number;
  cardHeight: number;
  definition: CardDefinition;
  /** World-space centre limits enforced while a card is under pointer control. */
  dragBounds: PhysicsTableBounds;
  /** Stable physical drop order for scripted arrangements and layer changes. */
  dropIndex?: number;
  /** Semantic layer revision; unlike dropIndex this changes at every move commit. */
  layerKey: number;
  /** One-shot deck release state used only when this rigid body first mounts. */
  initialLaunch?: PhysicsCardLaunch;
  /** Optional hand-off position supplied while the deck-cut controller owns a drag. */
  externalDragRef?: MutableRefObject<ExternalCardDrag | null>;
  onFlip: (cardId: string) => void;
  onHover: (cardId: string | null) => void;
  /** Records the user intent before solver-driven collision effects occur. */
  onMove: (cardId: string, position: TablePoint, rotation?: number) => void;
  onLaunchConsumed: (cardId: string, launch: PhysicsCardLaunch) => void;
  onRotate?: (cardId: string, degrees: number) => void;
  onSelect: (cardId: string | null) => void;
  onSettle: (
    cardId: string,
    pose: PhysicsCardPose,
    authorityKey: string
  ) => void;
  onSound: CardSoundPlayer;
  reducedMotion: boolean;
  selected: boolean;
  slabGeometry: ExtrudeGeometry;
  /** Table collider height in the Rapier scene. Defaults to 0. */
  tableSurfaceZ?: number;
  /** Card centre in the physics world's table plane. */
  worldPosition: TablePoint;
};

function isNearCardEdge(event: ThreeEvent<PointerEvent>) {
  const uv = event.uv;

  return Boolean(
    uv &&
      Math.min(uv.x, 1 - uv.x, uv.y, 1 - uv.y) <=
        ROTATION_EDGE_THRESHOLD
  );
}

function CardFace({
  artworkCrop,
  cardHeight,
  cardWidth,
  paperSeed,
  reverse = false,
  url,
}: {
  artworkCrop?: CardArtworkCrop;
  cardHeight: number;
  cardWidth: number;
  paperSeed: number;
  reverse?: boolean;
  url: string;
}) {
  const frameInset = Math.min(0.34, cardWidth * 0.105);
  const position: [number, number, number] = [
    0,
    0,
    (reverse ? -1 : 1) * CARD_VISIBLE_HALF_DEPTH,
  ];

  return (
    <Suspense fallback={null}>
      <CardArtwork
        url={url}
        crop={artworkCrop}
        position={position}
        rotation={reverse ? [0, Math.PI, 0] : undefined}
        width={Math.max(0.16, cardWidth - frameInset)}
        height={Math.max(0.26, cardHeight - frameInset)}
        paperSeed={paperSeed}
      />
    </Suspense>
  );
}

/**
 * A dynamic, full-3D Rapier table card. It expects to be rendered inside an
 * `@react-three/rapier` Physics provider with a horizontal table collider.
 */
export function PhysicsCard({
  authorityKey,
  card,
  cardHeight,
  cardSet,
  cardWidth,
  definition,
  dragBounds,
  dropIndex = 0,
  layerKey,
  initialLaunch,
  externalDragRef,
  onFlip,
  onHover,
  onMove,
  onLaunchConsumed,
  onRotate,
  onSelect,
  onSettle,
  onSound,
  reducedMotion,
  selected,
  slabGeometry,
  tableSurfaceZ = 0,
  worldPosition,
}: PhysicsCardProps) {
  const bodyRef = useRef<RapierRigidBody>(null);
  const dragRef = useRef<DragState | null>(null);
  const flipRef = useRef<FlipState | null>(null);
  const visualRef = useRef<Group>(null);
  const fallbackRef = useRef<PointerFallbackBinding | null>(null);
  const lostPointerCaptureRef =
    useRef<LostPointerCaptureBinding | null>(null);
  const mountedCardIdRef = useRef<string | null>(null);
  const lastLayerKeyRef = useRef(layerKey);
  const reconciledAuthorityKeyRef = useRef<string | null>(null);
  const reconciledSceneAuthorityKeyRef = useRef<string | null>(null);
  const skipNextAuthorityReconciliationRef = useRef(false);
  const externalDragActiveRef = useRef(false);
  const raycasterRef = useRef(new Raycaster());
  const pointerRef = useRef(new Vector2());
  const { rapier } = useRapier();
  const canvas = useThree((state) => state.gl.domElement);
  const camera = useThree((state) => state.camera);
  const invalidate = useThree((state) => state.invalidate);
  const cardPlane = useMemo(
    () => new Plane(new Vector3(0, 0, 1), -tableSurfaceZ),
    [tableSurfaceZ]
  );
  const [colliderWidth, colliderHeight, colliderDepth] = useMemo(
    () => getCardColliderHalfExtents(cardWidth, cardHeight, CARD_THICKNESS),
    [cardHeight, cardWidth]
  );
  const paperSeed = useMemo(() => getPaperSeed(card.id), [card.id]);
  const dropLift =
    CARD_PHYSICS.spawnLift +
    Math.min(12, Math.max(0, dropIndex)) * CARD_THICKNESS * 0.7;
  const initialZ = tableSurfaceZ + CARD_THICKNESS / 2 + dropLift;
  const worldX = worldPosition[0];
  const worldY = worldPosition[1];
  const initialLaunchRef = useRef<PhysicsCardLaunch | undefined>(
    isPhysicsLaunchForTarget(initialLaunch, [worldX, worldY])
      ? initialLaunch
      : undefined
  );
  const resolvedInitialLaunch = initialLaunchRef.current;
  const initialFaceUp = resolvedInitialLaunch?.faceUp ?? card.faceUp;
  const initialYaw = MathUtils.degToRad(
    resolvedInitialLaunch?.rotation ?? card.rotation
  );
  const sceneAuthorityKey = [
    authorityKey,
    worldX,
    worldY,
    tableSurfaceZ,
  ].join("|");
  const latestAuthorityRef = useRef({
    authorityKey,
    faceUp: card.faceUp,
    position: [worldX, worldY] as TablePoint,
    rotation: card.rotation,
    sceneAuthorityKey,
  });
  const initialPositionRef = useRef<[number, number, number]>([
    resolvedInitialLaunch?.position[0] ?? worldX,
    resolvedInitialLaunch?.position[1] ?? worldY,
    resolvedInitialLaunch
      ? Math.max(
          resolvedInitialLaunch.position[2],
          tableSurfaceZ + CARD_THICKNESS / 2 + CARD_PHYSICS.contactSkin
        )
      : initialZ,
  ]);
  const initialRotationRef = useRef<
    [number, number, number, "ZXY"]
  >([initialFaceUp ? 0 : Math.PI, 0, initialYaw, "ZXY"]);
  const dropLiftRef = useRef(dropLift);

  dropLiftRef.current = dropLift;
  latestAuthorityRef.current = {
    authorityKey,
    faceUp: card.faceUp,
    position: [worldX, worldY],
    rotation: card.rotation,
    sceneAuthorityKey,
  };

  const clearFallback = useCallback(() => {
    const binding = fallbackRef.current;

    if (!binding) {
      return;
    }

    document.removeEventListener("pointermove", binding.pointerMoveHandler);
    document.removeEventListener("pointerup", binding.pointerUpHandler);
    document.removeEventListener("pointercancel", binding.pointerCancelHandler);
    fallbackRef.current = null;
  }, []);

  const clearLostPointerCapture = useCallback(() => {
    const binding = lostPointerCaptureRef.current;

    if (!binding) {
      return;
    }

    binding.target.removeEventListener("lostpointercapture", binding.handler);
    lostPointerCaptureRef.current = null;
  }, []);

  const getPointerPoint = useCallback(
    (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect();
      const pointer = pointerRef.current;
      pointer.set(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        -((event.clientY - bounds.top) / bounds.height) * 2 + 1
      );
      raycasterRef.current.setFromCamera(pointer, camera);

      return (
        raycasterRef.current.ray.intersectPlane(cardPlane, new Vector3()) ??
        dragRef.current?.lastPoint.clone() ??
        new Vector3()
      );
    },
    [camera, canvas, cardPlane]
  );

  const releasePointer = useCallback(
    (pointerId: number, target?: PointerCaptureTarget) => {
      target?.releasePointerCapture?.(pointerId);
      if (canvas.hasPointerCapture(pointerId)) {
        canvas.releasePointerCapture(pointerId);
      }
    },
    [canvas]
  );

  const updateDrag = useCallback(
    (pointerId: number, point: Vector3, timestamp: number) => {
      const drag = dragRef.current;
      const body = bodyRef.current;

      if (!drag || !body || drag.pointerId !== pointerId) {
        return false;
      }

      // React Three Fiber and the document fallback both receive the same DOM
      // event. Sampling it twice would replace a real throw velocity with zero.
      if (
        drag.lastInputTimestamp === timestamp &&
        point.distanceToSquared(drag.lastPoint) <= 0.00000001
      ) {
        return true;
      }

      drag.lastInputTimestamp = timestamp;
      const elapsed = Math.max(
        0.004,
        Math.min(0.064, (timestamp - drag.lastTimestamp) / 1000)
      );
      const delta = point.clone().sub(drag.lastPoint);
      const movedThisSample = delta.lengthSq() > 0.00000001;

      if (movedThisSample) {
        const speed = Math.hypot(delta.x / elapsed, delta.y / elapsed);
        const scale =
          speed > MAX_POINTER_SPEED ? MAX_POINTER_SPEED / speed : 1;

        drag.pointerVelocity.x = (delta.x / elapsed) * scale;
        drag.pointerVelocity.y = (delta.y / elapsed) * scale;
        drag.lastMovementTimestamp = timestamp;
        drag.lastTimestamp = timestamp;
      }
      drag.lastPoint.copy(point);

      if (drag.mode === "rotate") {
        const translation = body.translation();
        const pointerAngle = Math.atan2(point.y - translation.y, point.x - translation.x);
        let angleDelta = pointerAngle - drag.startAngle;
        if (angleDelta > Math.PI) angleDelta -= Math.PI * 2;
        if (angleDelta < -Math.PI) angleDelta += Math.PI * 2;
        drag.previewRotation = drag.startRotation + MathUtils.radToDeg(angleDelta);
        drag.moved = Math.abs(drag.previewRotation - drag.startRotation) > 0.7;
      } else {
        const [targetX, targetY] = clampPhysicsPointToBounds(
          [point.x - drag.grabOffset.x, point.y - drag.grabOffset.y],
          dragBounds
        );
        drag.target.set(
          targetX,
          targetY,
          tableSurfaceZ + CARD_THICKNESS / 2 + CARD_PHYSICS.dragLift
        );
        drag.moved ||= point.distanceToSquared(drag.origin) > DRAG_THRESHOLD * DRAG_THRESHOLD;
      }

      invalidate();

      return true;
    },
    [dragBounds, invalidate, tableSurfaceZ]
  );

  const finishDrag = useCallback(
    ({ cancelled, pointerId, point, timestamp }: {
      cancelled?: boolean;
      pointerId: number;
      point: Vector3;
      timestamp: number;
    }) => {
      const drag = dragRef.current;
      const body = bodyRef.current;

      if (!drag || !body || drag.pointerId !== pointerId) {
        return false;
      }

      if (!cancelled) {
        updateDrag(pointerId, point, timestamp);
      }

      const translation = body.translation();
      const rotation = body.rotation();
      const targetRotation =
        drag.mode === "rotate"
          ? drag.previewRotation
          : getCardPose(translation, rotation).rotation;
      const targetPosition: TablePoint =
        drag.mode === "move"
          ? [drag.target.x, drag.target.y]
          : [translation.x, translation.y];
      const faceUp = getCardPose(translation, rotation).faceUp;

      body.setBodyType(rapier.RigidBodyType.Dynamic, true);
      if (cancelled) {
        body.setTranslation(drag.startTranslation, true);
        body.setRotation(drag.startQuaternion, true);
      } else if (drag.mode === "rotate") {
        const [x, y, z, w] = createCardQuaternion(targetRotation, faceUp);
        body.setRotation(
          { x, y, z, w },
          true
        );
      } else {
        body.setTranslation(
          {
            x: drag.target.x,
            y: drag.target.y,
            z: drag.target.z,
          },
          true
        );
      }

      if (!cancelled && drag.moved) {
        // Persist intent before the first dynamic step can turn a collision into a new pose.
        skipNextAuthorityReconciliationRef.current = true;
        if (drag.mode === "rotate") {
          if (onRotate) {
            onRotate(card.id, targetRotation - drag.startRotation);
          } else {
            onMove(card.id, targetPosition, targetRotation);
          }
        } else {
          onMove(card.id, targetPosition, targetRotation);
          const idleSeconds = Math.max(
            0,
            (timestamp - drag.lastMovementTimestamp) / 1000
          );
          const velocityDecay = Math.exp(-idleSeconds * 10);
          const release = constrainReleaseToBounds({
            bounds: dragBounds,
            kinematics: getReleaseKinematics({
              grabOffset: [drag.grabOffset.x, drag.grabOffset.y],
              pointerVelocity: [
                drag.pointerVelocity.x * velocityDecay,
                drag.pointerVelocity.y * velocityDecay,
              ],
              reducedMotion,
            }),
            position: targetPosition,
          });
          body.setLinvel(
            {
              x: release.linearVelocity[0],
              y: release.linearVelocity[1],
              z: release.linearVelocity[2],
            },
            true
          );
          body.setAngvel(
            {
              x: release.angularVelocity[0],
              y: release.angularVelocity[1],
              z: release.angularVelocity[2],
            },
            true
          );
        }
      } else {
        body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      }

      dragRef.current = null;
      canvas.style.cursor = "grab";
      invalidate();
      return true;
    },
    [
      canvas,
      card.id,
      dragBounds,
      invalidate,
      onMove,
      onRotate,
      rapier.RigidBodyType.Dynamic,
      reducedMotion,
      updateDrag,
    ]
  );

  useEffect(() => {
    const body = bodyRef.current;

    if (
      !body ||
      dragRef.current ||
      flipRef.current ||
      externalDragActiveRef.current
    ) {
      return;
    }

    const isNewBody = mountedCardIdRef.current !== card.id;
    const sceneAuthorityChanged =
      reconciledSceneAuthorityKeyRef.current !== sceneAuthorityKey;

    if (!isNewBody && !sceneAuthorityChanged) {
      return;
    }

    const layerChanged = lastLayerKeyRef.current !== layerKey;
    const currentPose = getCardPose(body.translation(), body.rotation());
    const targetPose: PhysicsCardPose = {
      faceUp: card.faceUp,
      position: [worldX, worldY],
      rotation: card.rotation,
    };
    const poseChanged = hasMeaningfulPoseChange(currentPose, targetPose);

    mountedCardIdRef.current = card.id;
    lastLayerKeyRef.current = layerKey;
    reconciledAuthorityKeyRef.current = authorityKey;
    reconciledSceneAuthorityKeyRef.current = sceneAuthorityKey;

    if (skipNextAuthorityReconciliationRef.current) {
      skipNextAuthorityReconciliationRef.current = false;
      return;
    }

    if (!isNewBody && !poseChanged && !layerChanged) {
      return;
    }

    const launch = isNewBody ? initialLaunchRef.current : undefined;
    const [x, y, z, w] = createCardQuaternion(
      launch?.rotation ?? targetPose.rotation,
      launch?.faceUp ?? targetPose.faceUp
    );
    const restingZ = tableSurfaceZ + CARD_THICKNESS / 2;
    const nextZ = isNewBody
      ? initialPositionRef.current[2]
      : Math.max(restingZ + dropLiftRef.current, body.translation().z);

    body.setBodyType(rapier.RigidBodyType.Dynamic, true);
    body.setTranslation(
      {
        x: launch?.position[0] ?? targetPose.position[0],
        y: launch?.position[1] ?? targetPose.position[1],
        z: nextZ,
      },
      true
    );
    body.setRotation({ x, y, z, w }, true);
    body.setLinvel(
      launch
        ? {
            x: launch.linearVelocity[0],
            y: launch.linearVelocity[1],
            z: launch.linearVelocity[2],
          }
        : { x: 0, y: 0, z: 0 },
      true
    );
    body.setAngvel(
      launch
        ? {
            x: launch.angularVelocity[0],
            y: launch.angularVelocity[1],
            z: launch.angularVelocity[2],
          }
        : { x: 0, y: 0, z: 0 },
      true
    );
    if (launch) {
      initialLaunchRef.current = undefined;
      onLaunchConsumed(card.id, launch);
    }
    invalidate();
  }, [
    authorityKey,
    card.faceUp,
    card.id,
    card.rotation,
    layerKey,
    invalidate,
    onLaunchConsumed,
    rapier.RigidBodyType.Dynamic,
    sceneAuthorityKey,
    tableSurfaceZ,
    worldX,
    worldY,
  ]);

  useEffect(
    () => () => {
      clearLostPointerCapture();
      clearFallback();
      canvas.style.cursor = "default";
    },
    [canvas, clearFallback, clearLostPointerCapture]
  );

  useBeforePhysicsStep(() => {
    const body = bodyRef.current;
    const externalDrag = externalDragRef?.current;
    const ownsExternalDrag = externalDrag?.cardId === card.id;

    if (!body) {
      return;
    }

    const flip = flipRef.current;

    if (flip) {
      const visual = visualRef.current;
      flip.elapsed = reducedMotion
        ? FLIP_DURATION_SECONDS
        : Math.min(
            FLIP_DURATION_SECONDS,
            flip.elapsed + CARD_PHYSICS.timeStep
          );
      const progress = flip.elapsed / FLIP_DURATION_SECONDS;
      const flipVisual = getFlipVisualState(progress);

      if (visual) {
        visual.position.z = flipVisual.lift * 0.008;
        visual.rotation.x = flipVisual.rotationX;
        visual.scale.set(
          flipVisual.scaleX,
          flipVisual.scaleY,
          1
        );
      }

      // The collider stays flat and stationary. Only the nested render group
      // flips, so deterministic UI choreography cannot sweep nearby bodies.
      body.setNextKinematicRotation(flip.rotation);
      body.setNextKinematicTranslation(flip.position);

      if (progress >= 1) {
        const latestAuthority = latestAuthorityRef.current;
        const [x, y, z, w] = createCardQuaternion(
          latestAuthority.rotation,
          latestAuthority.faceUp
        );

        if (visual) {
          visual.position.set(0, 0, 0);
          visual.rotation.set(0, 0, 0);
          visual.scale.set(1, 1, 1);
        }
        body.setRotation({ x, y, z, w }, true);
        body.setTranslation(
          {
            x: latestAuthority.position[0],
            y: latestAuthority.position[1],
            z: Math.max(
              flip.position.z,
              tableSurfaceZ + CARD_THICKNESS / 2 + CARD_PHYSICS.contactSkin
            ),
          },
          true
        );
        body.setBodyType(rapier.RigidBodyType.Dynamic, true);
        body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        body.setAngvel({ x: 0, y: 0, z: 0 }, true);
        mountedCardIdRef.current = card.id;
        lastLayerKeyRef.current = layerKey;
        reconciledAuthorityKeyRef.current = latestAuthority.authorityKey;
        reconciledSceneAuthorityKeyRef.current =
          latestAuthority.sceneAuthorityKey;
        flipRef.current = null;
      }

      return;
    }

    const drag = dragRef.current;
    if (ownsExternalDrag && externalDrag) {
      if (!externalDragActiveRef.current) {
        body.setBodyType(rapier.RigidBodyType.KinematicPositionBased, true);
        externalDragActiveRef.current = true;
      }
      body.setNextKinematicTranslation({
        x: externalDrag.position[0],
        y: externalDrag.position[1],
        z: tableSurfaceZ + CARD_THICKNESS / 2 + CARD_PHYSICS.dragLift,
      });
      return;
    }

    if (externalDragActiveRef.current && !drag) {
      body.setBodyType(rapier.RigidBodyType.Dynamic, true);
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      externalDragActiveRef.current = false;
    }

    if (!drag) {
      return;
    }

    if (drag.mode === "rotate") {
      const currentPose = getCardPose(body.translation(), body.rotation());
      const [x, y, z, w] = createCardQuaternion(
        drag.previewRotation,
        currentPose.faceUp
      );
      body.setNextKinematicRotation({ x, y, z, w });
    } else {
      body.setNextKinematicTranslation(drag.target);
    }
  });

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    if (
      event.nativeEvent.button !== 0 ||
      flipRef.current ||
      externalDragRef?.current?.cardId === card.id
    ) {
      return;
    }

    const body = bodyRef.current;
    if (!body) {
      return;
    }

    event.stopPropagation();
    const point = event.point.clone();
    const translation = body.translation();
    const rotation = body.rotation();
    const currentPose = getCardPose(translation, rotation);
    const mode: DragMode =
      selected &&
      event.nativeEvent.pointerType !== "touch" &&
      isNearCardEdge(event)
        ? "rotate"
        : "move";
    const target = event.target as unknown as PointerCaptureTarget;

    clearLostPointerCapture();
    target.setPointerCapture?.(event.pointerId);
    canvas.setPointerCapture?.(event.pointerId);
    clearFallback();
    body.setBodyType(rapier.RigidBodyType.KinematicPositionBased, true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    dragRef.current = {
      mode,
      pointerId: event.pointerId,
      grabOffset: new Vector3(
        point.x - translation.x,
        point.y - translation.y,
        0
      ),
      origin: point.clone(),
      lastPoint: point,
      lastInputTimestamp: event.timeStamp,
      lastMovementTimestamp: event.timeStamp,
      lastTimestamp: event.timeStamp,
      pointerVelocity: new Vector3(),
      target: new Vector3(
        translation.x,
        translation.y,
        tableSurfaceZ + CARD_THICKNESS / 2 + CARD_PHYSICS.dragLift
      ),
      startAngle: Math.atan2(point.y - translation.y, point.x - translation.x),
      startQuaternion: {
        w: rotation.w,
        x: rotation.x,
        y: rotation.y,
        z: rotation.z,
      },
      startRotation: currentPose.rotation,
      startTranslation: new Vector3(
        translation.x,
        translation.y,
        translation.z
      ),
      previewRotation: currentPose.rotation,
      moved: false,
    };
    onSelect(card.id);
    onSound("pickup");
    canvas.style.cursor = mode === "rotate" ? "crosshair" : "grabbing";
    invalidate();

    const handleLostPointerCapture = (lostEvent: PointerEvent) => {
      lostPointerCaptureRef.current = null;
      const activeDrag = dragRef.current;

      if (!activeDrag || activeDrag.pointerId !== lostEvent.pointerId) {
        return;
      }

      clearFallback();
      finishDrag({
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
      handler: handleLostPointerCapture,
      target: canvas,
    };

    const pointerMoveHandler = (nativeEvent: PointerEvent) => {
      if (nativeEvent.pointerId === event.pointerId) {
        updateDrag(
          nativeEvent.pointerId,
          getPointerPoint(nativeEvent),
          nativeEvent.timeStamp
        );
      }
    };
    const complete = (nativeEvent: PointerEvent, cancelled = false) => {
      if (nativeEvent.pointerId !== event.pointerId) {
        return;
      }
      clearLostPointerCapture();
      clearFallback();
      releasePointer(nativeEvent.pointerId);
      finishDrag({
        cancelled,
        pointerId: nativeEvent.pointerId,
        point: getPointerPoint(nativeEvent),
        timestamp: nativeEvent.timeStamp,
      });
    };
    const pointerUpHandler = (nativeEvent: PointerEvent) =>
      complete(nativeEvent);
    const pointerCancelHandler = (nativeEvent: PointerEvent) =>
      complete(nativeEvent, true);
    document.addEventListener("pointermove", pointerMoveHandler);
    document.addEventListener("pointerup", pointerUpHandler);
    document.addEventListener("pointercancel", pointerCancelHandler);
    fallbackRef.current = {
      pointerCancelHandler,
      pointerMoveHandler,
      pointerUpHandler,
    };
  };

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    const drag = dragRef.current;
    if (!drag) {
      if (event.nativeEvent.pointerType !== "touch") {
        canvas.style.cursor =
          selected && isNearCardEdge(event) ? "crosshair" : "grab";
      }
      return;
    }
    if (drag.pointerId === event.pointerId) {
      event.stopPropagation();
      updateDrag(event.pointerId, event.point, event.timeStamp);
    }
  };

  const handlePointerEnd = (
    event: ThreeEvent<PointerEvent>,
    cancelled = false
  ) => {
    event.stopPropagation();
    clearLostPointerCapture();
    clearFallback();
    releasePointer(event.pointerId, event.target as unknown as PointerCaptureTarget);
    finishDrag({
      cancelled,
      pointerId: event.pointerId,
      point: event.point,
      timestamp: event.timeStamp,
    });
  };

  const handleDoubleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    const body = bodyRef.current;
    if (!body || dragRef.current || flipRef.current) {
      return;
    }

    const translation = body.translation();
    const rotation = body.rotation();
    const visual = visualRef.current;

    body.setBodyType(rapier.RigidBodyType.KinematicPositionBased, true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    visual?.position.set(0, 0, 0);
    visual?.rotation.set(0, 0, 0);
    visual?.scale.set(1, 1, 1);
    flipRef.current = {
      elapsed: 0,
      position: new Vector3(
        translation.x,
        translation.y,
        translation.z
      ),
      rotation: {
        w: rotation.w,
        x: rotation.x,
        y: rotation.y,
        z: rotation.z,
      },
    };
    onFlip(card.id);
    invalidate();
  };

  return (
    <RigidBody
      ref={bodyRef}
      type="dynamic"
      colliders={false}
      position={initialPositionRef.current}
      rotation={initialRotationRef.current}
      ccd
      canSleep
      linearDamping={CARD_PHYSICS.linearDamping}
      angularDamping={CARD_PHYSICS.angularDamping}
      onSleep={() => {
        const body = bodyRef.current;
        const reconciledAuthorityKey = reconciledAuthorityKeyRef.current;
        const latestAuthority = latestAuthorityRef.current;
        if (
          !body ||
          !reconciledAuthorityKey ||
          reconciledSceneAuthorityKeyRef.current !==
            latestAuthority.sceneAuthorityKey ||
          dragRef.current ||
          flipRef.current ||
          externalDragActiveRef.current
        ) {
          return;
        }
        onSettle(
          card.id,
          getCardPose(body.translation(), body.rotation()),
          reconciledAuthorityKey
        );
      }}
    >
      <CuboidCollider
        args={[colliderWidth, colliderHeight, colliderDepth]}
        mass={CARD_PHYSICS.cardMassKilograms}
        friction={CARD_PHYSICS.cardFriction}
        restitution={CARD_PHYSICS.cardRestitution}
        contactSkin={CARD_PHYSICS.contactSkin}
      />
      <group ref={visualRef}>
        <mesh geometry={slabGeometry} castShadow receiveShadow>
          <CardPaperMaterial
            attach="material-0"
            color={TAROT_SCENE_PALETTE.cardPaper}
            roughness={0.94}
            paperSeed={paperSeed}
            cardSize={[cardWidth, cardHeight]}
            edgePatina={0.12}
          />
          <CardPaperMaterial
            attach="material-1"
            color="#cdbd9e"
            roughness={0.88}
            paperSeed={paperSeed + 0.213}
            cardSize={[cardWidth, cardHeight]}
            edgePatina={0.3}
          />
        </mesh>
        <CardFace
          url={definition.image.preview}
          artworkCrop={cardSet.artworkCrop}
          cardWidth={cardWidth}
          cardHeight={cardHeight}
          paperSeed={paperSeed}
        />
        <CardFace
          url={cardSet.back.preview}
          artworkCrop={cardSet.artworkCrop}
          cardWidth={cardWidth}
          cardHeight={cardHeight}
          paperSeed={paperSeed + 0.417}
          reverse
        />
      </group>
      <mesh
        position={[0, 0, CARD_VISIBLE_HALF_DEPTH + 0.004]}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={(event) => handlePointerEnd(event, true)}
        onPointerOver={(event) => {
          if (event.nativeEvent.pointerType !== "touch") {
            event.stopPropagation();
            onHover(card.id);
            canvas.style.cursor =
              selected && isNearCardEdge(event) ? "crosshair" : "grab";
          }
        }}
        onPointerOut={() => {
          onHover(null);
          if (!dragRef.current) canvas.style.cursor = "default";
        }}
        onDoubleClick={handleDoubleClick}
      >
        <planeGeometry args={[cardWidth, cardHeight]} />
        <meshBasicMaterial
          transparent
          opacity={0}
          side={DoubleSide}
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
    </RigidBody>
  );
}
