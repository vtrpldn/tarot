import { CARD_GEOMETRY, CARD_PHYSICS } from "@/lib/card-physics";
import type { RigidBody, Shape, World } from "@dimforge/rapier3d-compat";

export type CardDragMode = "move" | "rotate" | "elevate-tilt";

type CardUvPoint = { x: number; y: number };

type QuaternionLike = {
  w: number;
  x: number;
  y: number;
  z: number;
};

type Point3 = readonly [x: number, y: number, z: number];

type PlanarBounds = {
  bottom: number;
  left: number;
  right: number;
  top: number;
};

export type ElevationTiltGesture = {
  elevation: number;
  tiltRadians: number;
};

type DynamicDragForceOptions = {
  controlHeight: boolean;
  current: Point3;
  mass: number;
  maximumAcceleration: number;
  maximumBrakingAcceleration?: number;
  maximumSpeed: number;
  response: number;
  target: Point3;
  velocity: Point3;
  velocityResponse?: number;
};

/** Includes body-mode policy so leaving an authored overlap wakes the card. */
export function createPhysicsSceneAuthorityKey({
  authorityKey,
  position,
  restingZ,
  stabilizeAtRest,
  tableSurfaceZ,
}: {
  authorityKey: string;
  position: readonly [x: number, y: number];
  restingZ: number;
  stabilizeAtRest: boolean;
  tableSurfaceZ: number;
}): string {
  return [
    authorityKey,
    position[0],
    position[1],
    restingZ,
    tableSurfaceZ,
    stabilizeAtRest ? 1 : 0,
  ].join("|");
}

/**
 * A flip may finish while the dynamic body is still gliding. The session
 * authority, not a transient physics pose, tells us whether another user
 * command arrived during the animation.
 */
export function isFlipTargetCurrent({
  latestFaceUp,
  latestSceneAuthorityKey,
  targetFaceUp,
  targetSceneAuthorityKey,
}: {
  latestFaceUp: boolean;
  latestSceneAuthorityKey: string;
  targetFaceUp: boolean;
  targetSceneAuthorityKey: string;
}): boolean {
  return (
    latestFaceUp === targetFaceUp &&
    latestSceneAuthorityKey === targetSceneAuthorityKey
  );
}

/**
 * Converts a world-up presentation lift into card-local coordinates. This
 * stays world-up for face-down and collision-tilted cards without moving the
 * physical collider out of its contact band.
 */
export function getLocalOffsetForWorldUp({
  distance,
  quaternion,
}: {
  distance: number;
  quaternion: QuaternionLike;
}): [number, number, number] {
  const magnitude = Math.hypot(
    quaternion.x,
    quaternion.y,
    quaternion.z,
    quaternion.w
  );

  if (!Number.isFinite(magnitude) || magnitude === 0 || !Number.isFinite(distance)) {
    return [0, 0, 0];
  }

  const x = quaternion.x / magnitude;
  const y = quaternion.y / magnitude;
  const z = quaternion.z / magnitude;
  const w = quaternion.w / magnitude;

  // R^T * [0, 0, distance]: the local vector whose world transform is up.
  return [
    2 * (x * z - w * y) * distance,
    2 * (y * z + w * x) * distance,
    (1 - 2 * (x * x + y * y)) * distance,
  ];
}

/** Keeps ordinary border grabs movable while reserving corners for rotation. */
export function isNearCardRotationCorner(
  uv: CardUvPoint,
  threshold: number
): boolean {
  return (
    Math.min(uv.x, 1 - uv.x) <= threshold &&
    Math.min(uv.y, 1 - uv.y) <= threshold
  );
}

/** A move press picks up immediately; rotation and right-drag keep their threshold. */
export function shouldTakeDragPhysicsOwnership({
  hasPhysicsOwnership,
  mode,
  moved,
}: {
  hasPhysicsOwnership: boolean;
  mode: CardDragMode;
  moved: boolean;
}): boolean {
  return !hasPhysicsOwnership && (mode === "move" || moved);
}

/** Lift relative to the physical surface under this card, including a stack. */
export function getCardPickupHeight(currentZ: number, restingZ: number): number {
  return Math.max(currentZ, restingZ) + CARD_PHYSICS.pickupLift;
}

/** Detects a card or deck before a held card reaches it at pointer speed. */
export function isMoveDragObstructed({
  body,
  shape,
  target,
  world,
}: {
  body: RigidBody;
  shape: Shape;
  target: Point3;
  world: World;
}): boolean {
  const current = body.translation();
  const deltaX = target[0] - current.x;
  const deltaY = target[1] - current.y;
  const deltaZ = target[2] - current.z;
  const distance = Math.hypot(deltaX, deltaY, deltaZ);

  if (!Number.isFinite(distance) || distance === 0) {
    return false;
  }

  return Boolean(
    world.castShape(
      current,
      body.rotation(),
      {
        x: deltaX / distance,
        y: deltaY / distance,
        z: deltaZ / distance,
      },
      shape,
      CARD_PHYSICS.contactSkin,
      distance,
      false,
      undefined,
      undefined,
      undefined,
      body,
      (collider) => {
        const userData = collider.parent()?.userData;
        const kind =
          typeof userData === "object" && userData !== null &&
          "kind" in userData
            ? (userData as { kind?: unknown }).kind
            : undefined;

        return !collider.isSensor() && (kind === "card" || kind === "deck");
      }
    )
  );
}

/** Ordinary pickup holds the collider above the cloth, with gravity still active. */
export function getMoveDragForce(
  options: Pick<
    DynamicDragForceOptions,
    "current" | "mass" | "target" | "velocity"
  > & { obstructed?: boolean }
): [x: number, y: number, z: number] {
  const obstructed = options.obstructed ?? false;
  const [x, y] = getDynamicDragForce({
    ...options,
    controlHeight: false,
    maximumAcceleration: obstructed ? 28 : 80,
    maximumBrakingAcceleration: 220,
    maximumSpeed: obstructed ? 4.8 : 10,
    response: 40,
    velocityResponse: 64,
  });
  // A large pointer jump must not consume the acceleration needed to lift
  // against gravity. Both forces still go through the dynamic contact solver.
  const [, , z] = getDynamicDragForce({
    controlHeight: true,
    current: [0, 0, options.current[2]],
    mass: options.mass,
    maximumAcceleration: 55,
    maximumSpeed: 3.5,
    response: 32,
    target: [0, 0, options.target[2]],
    velocity: [0, 0, options.velocity[2]],
  });
  return [x, y, z];
}

/**
 * Right-click is a card interaction, so its native menu stays suppressed both
 * while the gesture is active and briefly after pointer release.
 */
export function shouldSuppressCardContextMenu({
  hasActiveRightGesture,
  now,
  suppressionDeadline,
}: {
  hasActiveRightGesture: boolean;
  now: number;
  suppressionDeadline: number;
}): boolean {
  return hasActiveRightGesture || now <= suppressionDeadline;
}

/**
 * Caps one kinematic sweep so a coalesced pointer event cannot tunnel through
 * a card before Rapier has a chance to generate contact impulses.
 */
export function getKinematicDragStep({
  current,
  maximumDistance,
  target,
}: {
  current: readonly [number, number, number];
  maximumDistance: number;
  target: readonly [number, number, number];
}): [number, number, number] {
  const deltaX = target[0] - current[0];
  const deltaY = target[1] - current[1];
  const deltaZ = target[2] - current[2];
  const distance = Math.hypot(deltaX, deltaY, deltaZ);

  if (!Number.isFinite(distance) || distance === 0) {
    return [current[0], current[1], current[2]];
  }

  const safeMaximumDistance = Math.max(0, maximumDistance);
  const scale = Math.min(1, safeMaximumDistance / distance);

  return [
    current[0] + deltaX * scale,
    current[1] + deltaY * scale,
    current[2] + deltaZ * scale,
  ];
}

/**
 * Pulls a held dynamic body toward the pointer with a damped,
 * acceleration-limited force. This preserves Rapier's collision response
 * instead of replacing it with a fresh velocity every physics step.
 */
export function getDynamicDragForce({
  controlHeight,
  current,
  mass,
  maximumAcceleration,
  maximumBrakingAcceleration = maximumAcceleration,
  maximumSpeed,
  response,
  target,
  velocity,
  velocityResponse = response,
}: DynamicDragForceOptions): [x: number, y: number, z: number] {
  const deltaX = target[0] - current[0];
  const deltaY = target[1] - current[1];
  const deltaZ = controlHeight ? target[2] - current[2] : 0;
  const distance = Math.hypot(deltaX, deltaY, deltaZ);

  if (!Number.isFinite(distance)) {
    return [0, 0, 0];
  }

  const safeResponse = Math.max(0, response);
  const desiredSpeed = Math.min(
    Math.max(0, maximumSpeed),
    distance * safeResponse
  );
  const directionScale = distance > 0 ? desiredSpeed / distance : 0;
  const desiredVelocityX = deltaX * directionScale;
  const desiredVelocityY = deltaY * directionScale;
  const desiredVelocityZ = controlHeight
    ? deltaZ * directionScale
    : velocity[2];
  const dampingResponse = Math.max(0, velocityResponse);
  const accelerationX = (desiredVelocityX - velocity[0]) * dampingResponse;
  const accelerationY = (desiredVelocityY - velocity[1]) * dampingResponse;
  const accelerationZ = controlHeight
    ? (desiredVelocityZ - velocity[2]) * dampingResponse
    : 0;
  // A quick hand stop needs stronger braking than the sustained pull into a
  // contact. Separate caps keep a responsive hold from oscillating at release.
  const isBraking =
    accelerationX * velocity[0] +
    accelerationY * velocity[1] +
    accelerationZ * velocity[2] < 0;
  const accelerationMagnitude = Math.hypot(
    accelerationX,
    accelerationY,
    accelerationZ
  );
  const accelerationScale =
    accelerationMagnitude > 0
      ? Math.min(
          1,
          Math.max(0, isBraking ? maximumBrakingAcceleration : maximumAcceleration) /
            accelerationMagnitude
        )
      : 0;
  const safeMass = Number.isFinite(mass) ? Math.max(0, mass) : 0;

  return [
    accelerationX * accelerationScale * safeMass,
    accelerationY * accelerationScale * safeMass,
    accelerationZ * accelerationScale * safeMass,
  ];
}

/** Gives vertical elevation a small readable lean in a top-down camera. */
export function getElevationCueLean({
  elevation,
  maximumElevationDelta,
  maximumLeanRadians,
  startElevation,
}: {
  elevation: number;
  maximumElevationDelta: number;
  maximumLeanRadians: number;
  startElevation: number;
}): number {
  const safeDelta = Math.max(0.000001, Math.abs(maximumElevationDelta));
  const normalizedDelta = Number.isFinite(elevation - startElevation)
    ? (elevation - startElevation) / safeDelta
    : 0;

  return (
    Math.min(1, Math.max(-1, normalizedDelta)) *
    Math.abs(maximumLeanRadians)
  );
}

/** Maps a right-drag on the table plane to bounded world height and tilt. */
export function getElevationTiltGesture({
  current,
  elevationScale,
  maximumElevation,
  maximumTiltRadians,
  minimumElevation,
  origin,
  startElevation,
  tiltScale,
}: {
  current: readonly [x: number, y: number];
  elevationScale: number;
  maximumElevation: number;
  maximumTiltRadians: number;
  minimumElevation: number;
  origin: readonly [x: number, y: number];
  startElevation: number;
  tiltScale: number;
}): ElevationTiltGesture {
  const verticalDelta = Number.isFinite(current[1] - origin[1])
    ? current[1] - origin[1]
    : 0;
  const horizontalDelta = Number.isFinite(current[0] - origin[0])
    ? current[0] - origin[0]
    : 0;
  const lower = Math.min(minimumElevation, maximumElevation);
  const upper = Math.max(minimumElevation, maximumElevation);

  return {
    elevation: Math.min(
      upper,
      Math.max(lower, startElevation + verticalDelta * elevationScale)
    ),
    tiltRadians: Math.min(
      Math.abs(maximumTiltRadians),
      Math.max(
        -Math.abs(maximumTiltRadians),
        horizontalDelta * tiltScale
      )
    ),
  };
}

/** Applies elevation lean and local-Y tilt to the captured physical orientation. */
export function getTiltedCardQuaternion(
  quaternion: QuaternionLike,
  tiltRadians: number,
  elevationLeanRadians = 0
): [x: number, y: number, z: number, w: number] {
  const multiply = (
    first: QuaternionLike,
    second: QuaternionLike
  ): QuaternionLike => ({
    w:
      first.w * second.w -
      first.x * second.x -
      first.y * second.y -
      first.z * second.z,
    x:
      first.w * second.x +
      first.x * second.w +
      first.y * second.z -
      first.z * second.y,
    y:
      first.w * second.y -
      first.x * second.z +
      first.y * second.w +
      first.z * second.x,
    z:
      first.w * second.z +
      first.x * second.y -
      first.y * second.x +
      first.z * second.w,
  });
  const halfElevationLean = Number.isFinite(elevationLeanRadians)
    ? elevationLeanRadians / 2
    : 0;
  const halfTilt = Number.isFinite(tiltRadians) ? tiltRadians / 2 : 0;
  const elevated = multiply(quaternion, {
    w: Math.cos(halfElevationLean),
    x: Math.sin(halfElevationLean),
    y: 0,
    z: 0,
  });
  const tilted = multiply(elevated, {
    w: Math.cos(halfTilt),
    x: 0,
    y: Math.sin(halfTilt),
    z: 0,
  });
  const { w, x, y, z } = tilted;
  const magnitude = Math.hypot(x, y, z, w);

  if (!Number.isFinite(magnitude) || magnitude === 0) {
    return [0, 0, 0, 1];
  }

  return [x / magnitude, y / magnitude, z / magnitude, w / magnitude];
}

/** Full bounding-circle separation for two cards at arbitrary table yaw. */
export function getLayerTransitionClearance({
  cardHeight,
  cardWidth,
  contactSkin,
}: {
  cardHeight: number;
  cardWidth: number;
  contactSkin: number;
}): number {
  const support = Math.max(0, contactSkin);

  return 2 * Math.hypot(
    Math.max(0, cardWidth) / 2 + CARD_GEOMETRY.bevelSize + support,
    Math.max(0, cardHeight) / 2 + CARD_GEOMETRY.bevelSize + support
  );
}

/**
 * Chooses a full-length escape lane that remains inside the table whenever
 * one is available. Raising cards use the horizontal lane and lowering cards
 * use the vertical lane, so the two halves of a swap cannot converge when one
 * of them turns inward at a rail.
 */
export function getLayerTransitionOffset({
  bounds,
  clearance,
  layerDirection,
  start,
}: {
  bounds: PlanarBounds;
  clearance: number;
  layerDirection: -1 | 1;
  start: readonly [x: number, y: number];
}): [x: number, y: number] {
  const safeClearance = Math.max(0, clearance);
  const candidates: ReadonlyArray<readonly [x: number, y: number]> =
    layerDirection > 0
      ? [
          [1, 0],
          [-1, 0],
        ]
      : [
          [0, -1],
          [0, 1],
        ];
  let bestDirection = candidates[0];
  let bestAvailableDistance = -Infinity;

  for (const candidate of candidates) {
    const magnitude = Math.hypot(candidate[0], candidate[1]) || 1;
    const direction: readonly [number, number] = [
      candidate[0] / magnitude,
      candidate[1] / magnitude,
    ];
    const distances: number[] = [];

    if (direction[0] > 0) {
      distances.push((bounds.right - start[0]) / direction[0]);
    } else if (direction[0] < 0) {
      distances.push((bounds.left - start[0]) / direction[0]);
    }
    if (direction[1] > 0) {
      distances.push((bounds.top - start[1]) / direction[1]);
    } else if (direction[1] < 0) {
      distances.push((bounds.bottom - start[1]) / direction[1]);
    }

    const availableDistance = Math.max(0, Math.min(...distances));
    if (availableDistance >= safeClearance) {
      return [
        direction[0] * safeClearance,
        direction[1] * safeClearance,
      ];
    }
    if (availableDistance > bestAvailableDistance) {
      bestAvailableDistance = availableDistance;
      bestDirection = direction;
    }
  }

  // Extremely small tables cannot contain the whole crossover. Preserve the
  // collision-safe distance even there; the card returns in the same gesture.
  return [
    bestDirection[0] * safeClearance,
    bestDirection[1] * safeClearance,
  ];
}

/**
 * Pulls a restacked card sideways, changes its height only while clear, then
 * returns it to the authored XY position. This avoids the old vertical swap
 * through another collider and reads like lifting a card out of a pile.
 */
export function getLayerTransitionPosition({
  lift,
  offset,
  progress,
  start,
  target,
}: {
  lift: number;
  offset: readonly [x: number, y: number];
  progress: number;
  start: Point3;
  target: Point3;
}): [x: number, y: number, z: number] {
  const boundedProgress = Math.min(1, Math.max(0, progress));
  const ease = (value: number) => value * value * (3 - 2 * value);
  const safeLift = Math.max(0, lift);
  let offsetProgress: number;
  let height: number;

  if (boundedProgress < 0.35) {
    const phase = ease(boundedProgress / 0.35);
    offsetProgress = phase;
    height = start[2];
  } else if (boundedProgress < 0.65) {
    const phase = ease((boundedProgress - 0.35) / 0.3);
    offsetProgress = 1;
    height =
      start[2] + (target[2] + safeLift - start[2]) * phase;
  } else {
    const phase = ease((boundedProgress - 0.65) / 0.35);
    offsetProgress = 1 - phase;
    height = target[2] + safeLift * (1 - phase);
  }

  return [
    start[0] + (target[0] - start[0]) * boundedProgress +
      offset[0] * offsetProgress,
    start[1] + (target[1] - start[1]) * boundedProgress +
      offset[1] * offsetProgress,
    height,
  ];
}

/** Changes authored yaw only after the card has fully cleared its old layer. */
export function shouldApplyLayerTransitionTargetRotation(
  progress: number
): boolean {
  return Number.isFinite(progress) && progress >= 0.35;
}

/**
 * Intentional overlap layouts need static rest layers: a dynamic 78-card
 * stack cannot retain its authored height under a mobile-safe solver budget.
 */
export function shouldStabilizeRestingLayer({
  hasAuthoredOverlap,
  hasLaunch,
  minimumRestingZ,
  restingZ,
}: {
  hasAuthoredOverlap: boolean;
  hasLaunch: boolean;
  minimumRestingZ: number;
  restingZ: number;
}): boolean {
  return (
    hasAuthoredOverlap &&
    !hasLaunch &&
    restingZ >= minimumRestingZ - 0.0001
  );
}

/**
 * A settled solver pose is valid only while no interaction owns the card and
 * the durable session revision still matches the body that produced it.
 */
export function canPersistSettledPhysicsPose({
  hasActiveDrag,
  hasActiveFlip,
  hasExternalDrag,
  latestSceneAuthorityKey,
  reconciledAuthorityKey,
  reconciledSceneAuthorityKey,
}: {
  hasActiveDrag: boolean;
  hasActiveFlip: boolean;
  hasExternalDrag: boolean;
  latestSceneAuthorityKey: string;
  reconciledAuthorityKey: string | null;
  reconciledSceneAuthorityKey: string | null;
}): boolean {
  return Boolean(
    reconciledAuthorityKey &&
      reconciledSceneAuthorityKey === latestSceneAuthorityKey &&
      !hasActiveDrag &&
      !hasActiveFlip &&
      !hasExternalDrag
  );
}

export type DurableCardPose = {
  faceUp: boolean;
  layerKey: number;
  position: readonly [number, number];
  rotation: number;
};

const normalizeRotation = (rotation: number) =>
  ((rotation + 180) % 360 + 360) % 360 - 180;

/** Identifies an external flip that should preserve the current physical pose. */
export function isFaceOnlyAuthorityChange(
  previous: DurableCardPose,
  next: DurableCardPose
): boolean {
  return (
    previous.faceUp !== next.faceUp &&
    previous.layerKey === next.layerKey &&
    Math.hypot(
      previous.position[0] - next.position[0],
      previous.position[1] - next.position[1]
    ) <= 0.0015 &&
    Math.abs(normalizeRotation(previous.rotation - next.rotation)) <= 0.08
  );
}
