"use client";

import {
  CuboidCollider,
  RigidBody,
  type CollisionEnterPayload,
  type RapierRigidBody,
  useBeforePhysicsStep,
  useRapier,
} from "@react-three/rapier";
import { type ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import {
  type MutableRefObject,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
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
  advanceFlipElapsed,
  CARD_PHYSICS,
  clampAngularVelocity,
  clampPhysicsPointToBounds,
  constrainReleaseToBounds,
  constrainVelocityForNextPhysicsStep,
  createCardQuaternion,
  flipCardQuaternion,
  getCardColliderHalfExtents,
  getCardPose,
  getFlipVisualState,
  getReleaseKinematics,
  getSmoothedPointerVelocity,
  hasMeaningfulPoseChange,
  isPhysicsLaunchForTarget,
  shouldUseDeckClearanceArc,
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
import {
  canPersistSettledPhysicsPose,
  getFlipHandoffAction,
  getFlipHandoffResolution,
  getKinematicDragStep,
  getLocalOffsetForWorldUp,
  isFaceOnlyAuthorityChange,
  isNearCardRotationCorner,
  shouldStabilizeRestingLayer,
  shouldTakeDragPhysicsOwnership,
  type DurableCardPose,
} from "./physics-card-drag";
import { TAROT_SCENE_PALETTE } from "./theme";

const CARD_FACE_PLANE_OFFSET = 0.002;
const CARD_VISIBLE_HALF_DEPTH = CARD_THICKNESS / 2 + CARD_FACE_PLANE_OFFSET;
const DRAG_THRESHOLD = 0.035;
const ROTATION_EDGE_THRESHOLD = 0.14;
const MAX_POINTER_SPEED = 8;
// Keep the actual collider within the vertical contact band of resting cards.
// The visible pickup lift is applied only to the nested presentation group.
const PHYSICAL_DRAG_LIFT = 0.006;
const VISUAL_DRAG_LIFT = CARD_PHYSICS.dragLift - PHYSICAL_DRAG_LIFT;
const COLLISION_ACTIVATION_TRANSFER = 0.55;
const COLLISION_ACTIVATION_MIN_SPEED = 0.08;

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
  startBodyType: number;
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
  startFaceUp: boolean;
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
  /** Expanded physical deck footprint that needs an elevated crossing arc. */
  deckClearanceBounds?: PhysicsTableBounds;
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
  /** Ephemeral collider-centre height derived from the current table layout. */
  restingZ?: number;
  selected: boolean;
  slabGeometry: ExtrudeGeometry;
  /** Whether this card belongs to an authored XY-overlap component. */
  stabilizeAtRest?: boolean;
  /** Table collider height in the Rapier scene. Defaults to 0. */
  tableSurfaceZ?: number;
  /** Card centre in the physics world's table plane. */
  worldPosition: TablePoint;
};

function isNearCardEdge(event: ThreeEvent<PointerEvent>) {
  const uv = event.uv;

  return Boolean(
    uv && isNearCardRotationCorner(uv, ROTATION_EDGE_THRESHOLD)
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
  deckClearanceBounds,
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
  restingZ: requestedRestingZ,
  selected,
  slabGeometry,
  stabilizeAtRest = false,
  tableSurfaceZ = 0,
  worldPosition,
}: PhysicsCardProps) {
  const bodyRef = useRef<RapierRigidBody>(null);
  const dragRef = useRef<DragState | null>(null);
  const flipRef = useRef<FlipState | null>(null);
  const flipHandoffPendingRef = useRef(false);
  const flipAnimationFrameRef = useRef<number | null>(null);
  const visualRef = useRef<Group>(null);
  const fallbackRef = useRef<PointerFallbackBinding | null>(null);
  const lostPointerCaptureRef =
    useRef<LostPointerCaptureBinding | null>(null);
  const mountedCardIdRef = useRef<string | null>(null);
  const lastLayerKeyRef = useRef(layerKey);
  const lastRestingZRef = useRef<number | null>(null);
  const reconciledAuthorityKeyRef = useRef<string | null>(null);
  const reconciledSceneAuthorityKeyRef = useRef<string | null>(null);
  const skipNextAuthorityReconciliationRef = useRef(false);
  const externalDragActiveRef = useRef(false);
  const collisionActivatedRef = useRef(false);
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
  const [authorityReconciliationVersion, requestAuthorityReconciliation] =
    useReducer((version: number) => version + 1, 0);
  const paperSeed = useMemo(() => getPaperSeed(card.id), [card.id]);
  const dropLift =
    CARD_PHYSICS.spawnLift +
    Math.min(12, Math.max(0, dropIndex)) * CARD_THICKNESS * 0.7;
  const minimumRestingZ =
    tableSurfaceZ + CARD_THICKNESS / 2 + CARD_PHYSICS.contactSkin;
  const restingZ = Number.isFinite(requestedRestingZ)
    ? Math.max(minimumRestingZ, requestedRestingZ ?? minimumRestingZ)
    : minimumRestingZ;
  const initialZ = stabilizeAtRest ? restingZ : restingZ + dropLift;
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
    restingZ,
    tableSurfaceZ,
  ].join("|");
  const latestAuthorityRef = useRef({
    authorityKey,
    faceUp: card.faceUp,
    position: [worldX, worldY] as TablePoint,
    rotation: card.rotation,
    sceneAuthorityKey,
  });
  const durablePoseRef = useRef<DurableCardPose>({
    faceUp: card.faceUp,
    layerKey,
    position: [worldX, worldY],
    rotation: card.rotation,
  });
  const initialPositionRef = useRef<[number, number, number]>([
    resolvedInitialLaunch?.position[0] ?? worldX,
    resolvedInitialLaunch?.position[1] ?? worldY,
    resolvedInitialLaunch
      ? Math.max(
          resolvedInitialLaunch.position[2],
          restingZ
        )
      : initialZ,
  ]);
  const initialRotationRef = useRef<
    [number, number, number, "ZXY"]
  >([0, initialFaceUp ? 0 : Math.PI, initialYaw, "ZXY"]);
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

  const setVisualDragLift = useCallback((active: boolean) => {
    const visual = visualRef.current;

    if (!visual || flipRef.current) {
      return;
    }

    if (!active) {
      visual.position.set(0, 0, 0);
      return;
    }

    const rotation = bodyRef.current?.rotation();
    const localOffset: [number, number, number] = rotation
      ? getLocalOffsetForWorldUp({
          distance: VISUAL_DRAG_LIFT,
          quaternion: rotation,
        })
      : [0, 0, VISUAL_DRAG_LIFT];

    visual.position.set(...localOffset);
  }, []);

  const keepFlipFramesRunning = useCallback(() => {
    if (flipAnimationFrameRef.current !== null) {
      return;
    }

    const requestNextFrame = () => {
      flipAnimationFrameRef.current = window.requestAnimationFrame(() => {
        flipAnimationFrameRef.current = null;
        invalidate();

        if (flipRef.current || flipHandoffPendingRef.current) {
          requestNextFrame();
        }
      });
    };

    requestNextFrame();
  }, [invalidate]);

  const activateAuthoredCardOnImpact = useCallback(
    ({ other }: CollisionEnterPayload) => {
      const body = bodyRef.current;
      const otherBody = other.rigidBody;

      // Authored upper layers are kinematic only while at rest. Let a moving
      // card wake one into a bounded dynamic response instead of making a
      // stack, compact fan, or collection behave like an immovable wall.
      if (
        !body ||
        !otherBody ||
        dragRef.current ||
        body.bodyType() !== rapier.RigidBodyType.KinematicPositionBased ||
        otherBody.bodyType() === rapier.RigidBodyType.Fixed
      ) {
        return;
      }

      const incoming = otherBody.linvel();
      const planarSpeed = Math.hypot(incoming.x, incoming.y);

      if (planarSpeed < COLLISION_ACTIVATION_MIN_SPEED) {
        return;
      }

      const transferScale = Math.min(
        COLLISION_ACTIVATION_TRANSFER,
        CARD_PHYSICS.maxPlanarSpeed / planarSpeed
      );
      collisionActivatedRef.current = true;
      body.setBodyType(rapier.RigidBodyType.Dynamic, true);
      body.setLinvel(
        {
          x: incoming.x * transferScale,
          y: incoming.y * transferScale,
          z: Math.max(0, Math.min(0.45, incoming.z * transferScale)),
        },
        true
      );
      invalidate();
    },
    [
      invalidate,
      rapier.RigidBodyType.Dynamic,
      rapier.RigidBodyType.Fixed,
      rapier.RigidBodyType.KinematicPositionBased,
    ]
  );

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
        0,
        (timestamp - drag.lastTimestamp) / 1000
      );
      const delta = point.clone().sub(drag.lastPoint);
      const movedThisSample = delta.lengthSq() > 0.00000001;

      if (movedThisSample) {
        const [velocityX, velocityY] = getSmoothedPointerVelocity({
          delta: [delta.x, delta.y],
          elapsedSeconds: elapsed,
          maxSpeed: MAX_POINTER_SPEED,
          previousVelocity: [
            drag.pointerVelocity.x,
            drag.pointerVelocity.y,
          ],
        });
        drag.pointerVelocity.set(velocityX, velocityY, 0);
        drag.lastMovementTimestamp = timestamp;
        drag.lastTimestamp = timestamp;
      }
      drag.lastPoint.copy(point);

      const wasMoved = drag.moved;
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
          restingZ + PHYSICAL_DRAG_LIFT
        );
        drag.moved ||= point.distanceToSquared(drag.origin) > DRAG_THRESHOLD * DRAG_THRESHOLD;
      }

      // A press must leave an undisturbed collider alone. Physics ownership
      // starts only once the pointer has crossed the drag threshold.
      if (shouldTakeDragPhysicsOwnership(wasMoved, drag.moved)) {
        body.setBodyType(rapier.RigidBodyType.KinematicPositionBased, true);
        body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        body.setAngvel({ x: 0, y: 0, z: 0 }, true);
        setVisualDragLift(true);
      }

      invalidate();

      return true;
    },
    [
      dragBounds,
      invalidate,
      rapier.RigidBodyType.KinematicPositionBased,
      restingZ,
      setVisualDragLift,
    ]
  );

  const beginVisualFlip = useCallback(() => {
    const visual = visualRef.current;
    const body = bodyRef.current;

    if (!body || flipRef.current || flipHandoffPendingRef.current) {
      return;
    }

    visual?.position.set(0, 0, 0);
    visual?.rotation.set(0, 0, 0);
    visual?.scale.set(1, 1, 1);
    flipRef.current = {
      elapsed: 0,
      startFaceUp: getCardPose(body.translation(), body.rotation()).faceUp,
    };
    keepFlipFramesRunning();
    invalidate();
  }, [invalidate, keepFlipFramesRunning]);

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
      const latestAuthority = latestAuthorityRef.current;

      if (!drag.moved) {
        dragRef.current = null;
        canvas.style.cursor = "grab";
        // A face command can arrive while this pointer owns the card. Complete
        // it here so a later sleep callback cannot restore the stale face.
        if (faceUp !== latestAuthority.faceUp) {
          beginVisualFlip();
        } else {
          invalidate();
        }
        return true;
      }

      const restoreAuthoredKinematicBody =
        drag.startBodyType === rapier.RigidBodyType.KinematicPositionBased &&
        (cancelled || drag.mode === "rotate");
      body.setBodyType(
        restoreAuthoredKinematicBody
          ? rapier.RigidBodyType.KinematicPositionBased
          : rapier.RigidBodyType.Dynamic,
        true
      );
      if (cancelled) {
        body.setTranslation(drag.startTranslation, true);
        body.setRotation(drag.startQuaternion, true);
      } else if (drag.mode === "rotate") {
        const [x, y, z, w] = createCardQuaternion(
          targetRotation,
          latestAuthority.faceUp
        );
        body.setRotation(
          { x, y, z, w },
          true
        );
      } else {
        // Keep the swept physical position instead of teleporting through a
        // card after the final pointer sample.
        const [x, y, z, w] = createCardQuaternion(
          targetRotation,
          latestAuthority.faceUp
        );
        body.setRotation({ x, y, z, w }, true);
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
          const kinematics = getReleaseKinematics({
            grabOffset: [drag.grabOffset.x, drag.grabOffset.y],
            pointerVelocity: [
              drag.pointerVelocity.x * velocityDecay,
              drag.pointerVelocity.y * velocityDecay,
            ],
            reducedMotion,
          });
          const releasePosition = body.translation();
          const releasePoint: TablePoint = [
            releasePosition.x,
            releasePosition.y,
          ];
          const clearsDeck = shouldUseDeckClearanceArc({
            bounds: deckClearanceBounds,
            kinematics,
            origin: releasePoint,
          });
          const release = constrainReleaseToBounds({
            bounds: dragBounds,
            kinematics: {
              angularVelocity: kinematics.angularVelocity,
              linearVelocity: [
                kinematics.linearVelocity[0],
                kinematics.linearVelocity[1],
                clearsDeck ? kinematics.linearVelocity[2] : 0,
              ],
            },
            position: releasePoint,
          });
          if (clearsDeck) {
            body.setTranslation(
              {
                x: releasePosition.x,
                y: releasePosition.y,
                z: Math.max(
                  releasePosition.z,
                  restingZ + CARD_PHYSICS.dragLift
                ),
              },
              true
            );
          }
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
      setVisualDragLift(false);
      canvas.style.cursor = "grab";
      if (cancelled && faceUp !== latestAuthority.faceUp) {
        beginVisualFlip();
      }
      invalidate();
      return true;
    },
    [
      beginVisualFlip,
      canvas,
      card.id,
      deckClearanceBounds,
      dragBounds,
      invalidate,
      onMove,
      onRotate,
      rapier.RigidBodyType.Dynamic,
      rapier.RigidBodyType.KinematicPositionBased,
      reducedMotion,
      restingZ,
      setVisualDragLift,
      updateDrag,
    ]
  );

  useEffect(() => {
    const body = bodyRef.current;

    if (
      !body ||
      dragRef.current ||
      flipRef.current ||
      flipHandoffPendingRef.current ||
      externalDragActiveRef.current
    ) {
      return;
    }

    const isNewBody = mountedCardIdRef.current !== card.id;
    if (isNewBody && mountedCardIdRef.current !== null) {
      collisionActivatedRef.current = false;
    }
    const sceneAuthorityChanged =
      reconciledSceneAuthorityKeyRef.current !== sceneAuthorityKey;

    if (!isNewBody && !sceneAuthorityChanged) {
      return;
    }

    const layerChanged = lastLayerKeyRef.current !== layerKey;
    const restingHeightChanged = lastRestingZRef.current !== restingZ;
    const currentPose = getCardPose(body.translation(), body.rotation());
    const targetPose: PhysicsCardPose = {
      faceUp: card.faceUp,
      position: [worldX, worldY],
      rotation: card.rotation,
    };
    const nextDurablePose: DurableCardPose = {
      faceUp: targetPose.faceUp,
      layerKey,
      position: targetPose.position,
      rotation: targetPose.rotation,
    };
    const poseChanged = hasMeaningfulPoseChange(currentPose, targetPose);
    const faceOnlyAuthorityChange =
      !isNewBody &&
      isFaceOnlyAuthorityChange(durablePoseRef.current, nextDurablePose);

    mountedCardIdRef.current = card.id;
    lastLayerKeyRef.current = layerKey;
    lastRestingZRef.current = restingZ;
    reconciledAuthorityKeyRef.current = authorityKey;
    reconciledSceneAuthorityKeyRef.current = sceneAuthorityKey;

    if (skipNextAuthorityReconciliationRef.current) {
      skipNextAuthorityReconciliationRef.current = false;
      durablePoseRef.current = nextDurablePose;
      return;
    }

    if (faceOnlyAuthorityChange) {
      durablePoseRef.current = nextDurablePose;
      beginVisualFlip();
      return;
    }

    if (!isNewBody && !poseChanged && !layerChanged && !restingHeightChanged) {
      durablePoseRef.current = nextDurablePose;
      return;
    }

    const launch = isNewBody ? initialLaunchRef.current : undefined;
    const preserveAuthoredRestingLayer =
      !collisionActivatedRef.current &&
      shouldStabilizeRestingLayer({
        hasAuthoredOverlap: stabilizeAtRest,
        hasLaunch: Boolean(launch),
        minimumRestingZ,
        restingZ,
      });
    const [x, y, z, w] = createCardQuaternion(
      launch?.rotation ?? targetPose.rotation,
      launch?.faceUp ?? targetPose.faceUp
    );
    const nextZ = preserveAuthoredRestingLayer
      ? restingZ
      : isNewBody
        ? initialPositionRef.current[2]
        : Math.max(restingZ + dropLiftRef.current, body.translation().z);

    body.setBodyType(
      preserveAuthoredRestingLayer
        ? rapier.RigidBodyType.KinematicPositionBased
        : rapier.RigidBodyType.Dynamic,
      true
    );
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
    durablePoseRef.current = nextDurablePose;
    invalidate();
  }, [
    authorityKey,
    beginVisualFlip,
    card.faceUp,
    card.id,
    card.rotation,
    layerKey,
    invalidate,
    minimumRestingZ,
    onLaunchConsumed,
    rapier.RigidBodyType.Dynamic,
    rapier.RigidBodyType.KinematicPositionBased,
    restingZ,
    sceneAuthorityKey,
    stabilizeAtRest,
    tableSurfaceZ,
    worldX,
    worldY,
    authorityReconciliationVersion,
  ]);

  useEffect(
    () => () => {
      if (flipAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(flipAnimationFrameRef.current);
        flipAnimationFrameRef.current = null;
      }
      clearLostPointerCapture();
      clearFallback();
      canvas.style.cursor = "default";
    },
    [canvas, clearFallback, clearLostPointerCapture]
  );

  useFrame((_, delta) => {
    const body = bodyRef.current;
    const flip = flipRef.current;

    if (!body) {
      return;
    }

    const visual = visualRef.current;
    if (
      getFlipHandoffAction({
        handoffPending: flipHandoffPendingRef.current,
        visualComplete: false,
      }) === "reset"
    ) {
      // This frame runs after @react-three/rapier has copied the physical
      // half-turn into Three.js. It is now safe to remove the visual turn.
      visual?.position.set(0, 0, 0);
      visual?.rotation.set(0, 0, 0);
      visual?.scale.set(1, 1, 1);
      flipHandoffPendingRef.current = false;
      const latestAuthority = latestAuthorityRef.current;
      const currentPose = getCardPose(body.translation(), body.rotation());
      const handoffResolution = getFlipHandoffResolution({
        currentFaceUp: currentPose.faceUp,
        currentSceneAuthorityKey: reconciledSceneAuthorityKeyRef.current,
        targetFaceUp: latestAuthority.faceUp,
        targetSceneAuthorityKey: latestAuthority.sceneAuthorityKey,
      });

      // Keyboard and inspector commands live outside this mesh, so another
      // face, rotation, layer, or move command can land during the one-frame
      // physical handoff. Replay the complete authority after synchronization.
      if (handoffResolution === "flip") {
        beginVisualFlip();
      } else if (handoffResolution === "reconcile") {
        requestAuthorityReconciliation();
      }
      return;
    }

    if (!flip) {
      return;
    }

    // A demand-rendered scene can sit idle for seconds before this frame.
    // Clamp that stale delta so a flip still paints its intermediate poses.
    flip.elapsed = advanceFlipElapsed({
      durationSeconds: FLIP_DURATION_SECONDS,
      elapsedSeconds: flip.elapsed,
      frameDeltaSeconds: delta,
      reducedMotion,
    });
    const progress = flip.elapsed / FLIP_DURATION_SECONDS;
    const flipVisual = getFlipVisualState(progress);

    if (visual) {
      visual.position.set(0, 0, 0);
      visual.rotation.y = flipVisual.rotationY;
      visual.scale.set(flipVisual.scaleX, flipVisual.scaleY, 1);
    }

    if (
      getFlipHandoffAction({
        handoffPending: false,
        visualComplete: progress >= 1,
      }) === "animate"
    ) {
      invalidate();
      return;
    }

    const latestAuthority = latestAuthorityRef.current;
    const currentRotation = body.rotation();
    const currentPose = getCardPose(body.translation(), currentRotation);
    const completedFaceUp = !flip.startFaceUp;
    const completedLatestAuthority =
      completedFaceUp === latestAuthority.faceUp &&
      !hasMeaningfulPoseChange(
        {
          faceUp: completedFaceUp,
          position: currentPose.position,
          rotation: currentPose.rotation,
        },
        {
          faceUp: latestAuthority.faceUp,
          position: latestAuthority.position,
          rotation: latestAuthority.rotation,
        }
      ) &&
      lastLayerKeyRef.current === layerKey &&
      lastRestingZRef.current === restingZ;

    if (currentPose.faceUp !== completedFaceUp) {
      const [x, y, z, w] = flipCardQuaternion(currentRotation);
      body.setRotation({ x, y, z, w }, !body.isSleeping());
    }
    if (completedLatestAuthority) {
      mountedCardIdRef.current = card.id;
      lastLayerKeyRef.current = layerKey;
      reconciledAuthorityKeyRef.current = latestAuthority.authorityKey;
      reconciledSceneAuthorityKeyRef.current =
        latestAuthority.sceneAuthorityKey;
      durablePoseRef.current = {
        faceUp: latestAuthority.faceUp,
        layerKey,
        position: latestAuthority.position,
        rotation: latestAuthority.rotation,
      };
    }
    flipRef.current = null;
    // Keep the target face visible in this render. The next demand frame will
    // receive Rapier's physical half-turn before resetting the visual group.
    flipHandoffPendingRef.current = true;
    invalidate();
    const reconciledAuthorityKey = completedLatestAuthority
      ? reconciledAuthorityKeyRef.current
      : null;

    // Rapier can put a moving body to sleep during the presentation-only
    // flip. Its onSleep callback correctly rejects that in-flight state, so
    // persist once here after the body has the final physical half-turn.
    if (
      body.isSleeping() &&
      reconciledAuthorityKey &&
      canPersistSettledPhysicsPose({
        hasActiveDrag: dragRef.current !== null,
        hasActiveFlip: false,
        hasExternalDrag: externalDragActiveRef.current,
        latestSceneAuthorityKey: latestAuthority.sceneAuthorityKey,
        reconciledAuthorityKey,
        reconciledSceneAuthorityKey:
          reconciledSceneAuthorityKeyRef.current,
      })
    ) {
      onSettle(
        card.id,
        getCardPose(body.translation(), body.rotation()),
        reconciledAuthorityKey
      );
    }
  });

  useBeforePhysicsStep(() => {
    const body = bodyRef.current;
    const externalDrag = externalDragRef?.current;
    const ownsExternalDrag = externalDrag?.cardId === card.id;

    if (!body) {
      return;
    }

    if (body.bodyType() === rapier.RigidBodyType.Dynamic) {
      const translation = body.translation();
      const velocity = body.linvel();
      const angularVelocity = body.angvel();
      const [x, y, z] = constrainVelocityForNextPhysicsStep({
        bounds: dragBounds,
        position: [translation.x, translation.y],
        timeStepSeconds: CARD_PHYSICS.timeStep,
        velocity: [velocity.x, velocity.y, velocity.z],
      });

      if (x !== velocity.x || y !== velocity.y) {
        body.setLinvel({ x, y, z }, true);
      }

      const [angularX, angularY, angularZ] = clampAngularVelocity([
        angularVelocity.x,
        angularVelocity.y,
        angularVelocity.z,
      ]);
      if (
        angularX !== angularVelocity.x ||
        angularY !== angularVelocity.y ||
        angularZ !== angularVelocity.z
      ) {
        body.setAngvel({ x: angularX, y: angularY, z: angularZ }, true);
      }
    }

    const flip = flipRef.current;

    if (flip) {
      // Physics stays fully dynamic while the nested presentation turns.
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
        z: restingZ + CARD_PHYSICS.dragLift,
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

    if (!drag.moved) {
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
      const currentTranslation = body.translation();
      const [x, y, z] = getKinematicDragStep({
        current: [
          currentTranslation.x,
          currentTranslation.y,
          currentTranslation.z,
        ],
        maximumDistance: MAX_POINTER_SPEED * CARD_PHYSICS.timeStep,
        target: [drag.target.x, drag.target.y, drag.target.z],
      });
      body.setNextKinematicTranslation({ x, y, z });

      if (
        Math.hypot(x - drag.target.x, y - drag.target.y, z - drag.target.z) >
        0.00001
      ) {
        // Continue the capped sweep under a demand frameloop until it reaches
        // the latest pointer target, giving Rapier a contact step between each
        // position update.
        invalidate();
      }
    }
  });

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    if (
      event.nativeEvent.button !== 0 ||
      flipRef.current ||
      flipHandoffPendingRef.current ||
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
        restingZ + PHYSICAL_DRAG_LIFT
      ),
      startAngle: Math.atan2(point.y - translation.y, point.x - translation.x),
      startQuaternion: {
        w: rotation.w,
        x: rotation.x,
        y: rotation.y,
        z: rotation.z,
      },
      startBodyType: body.bodyType(),
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
      updateDrag(
        event.pointerId,
        getPointerPoint(event.nativeEvent),
        event.timeStamp
      );
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
      // Pointer capture can keep dispatching to this mesh after the ray has
      // left it, leaving ThreeEvent.point at the last card intersection. Use
      // the DOM pointer projected onto the table so release cannot snap back
      // to a stale grab point.
      point: getPointerPoint(event.nativeEvent),
      timestamp: event.timeStamp,
    });
  };

  const handleDoubleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    const body = bodyRef.current;
    if (
      !body ||
      dragRef.current ||
      flipRef.current ||
      flipHandoffPendingRef.current
    ) {
      return;
    }

    beginVisualFlip();
    onFlip(card.id);
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
      onCollisionEnter={activateAuthoredCardOnImpact}
      onSleep={() => {
        const body = bodyRef.current;
        const reconciledAuthorityKey = reconciledAuthorityKeyRef.current;
        const latestAuthority = latestAuthorityRef.current;
        if (
          !body ||
          !reconciledAuthorityKey ||
          !canPersistSettledPhysicsPose({
            hasActiveDrag: dragRef.current !== null,
            hasActiveFlip: flipRef.current !== null,
            hasExternalDrag: externalDragActiveRef.current,
            latestSceneAuthorityKey: latestAuthority.sceneAuthorityKey,
            reconciledAuthorityKey,
            reconciledSceneAuthorityKey:
              reconciledSceneAuthorityKeyRef.current,
          })
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
        activeCollisionTypes={
          rapier.ActiveCollisionTypes.DEFAULT |
          rapier.ActiveCollisionTypes.KINEMATIC_KINEMATIC
        }
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
      {/* Keep the raycast surface at the collider centre. A face-down card's
          local +Z side is below the cloth, so a side-mounted plane can let a
          lower face-up card win pointer hits in an overlapping stack. */}
      <mesh
        position={[0, 0, 0]}
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
