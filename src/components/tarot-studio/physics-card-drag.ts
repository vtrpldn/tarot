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

export type FlipHandoffAction = "animate" | "commit" | "reset";
export type FlipHandoffResolution = "flip" | "reconcile" | "settled";

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
 * Separates the last visual flip frame from the next frame that receives
 * Rapier's physical half-turn. Resetting the nested visual group only after
 * that sync prevents a one-frame flash of the old physical face.
 */
export function getFlipHandoffAction({
  handoffPending,
  visualComplete,
}: {
  handoffPending: boolean;
  visualComplete: boolean;
}): FlipHandoffAction {
  if (handoffPending) {
    return "reset";
  }

  return visualComplete ? "commit" : "animate";
}

/** Replays every authority change that can arrive during the handoff frame. */
export function getFlipHandoffResolution({
  currentFaceUp,
  currentSceneAuthorityKey,
  targetFaceUp,
  targetSceneAuthorityKey,
}: {
  currentFaceUp: boolean;
  currentSceneAuthorityKey: string | null;
  targetFaceUp: boolean;
  targetSceneAuthorityKey: string;
}): FlipHandoffResolution {
  if (currentFaceUp !== targetFaceUp) {
    return "flip";
  }

  return currentSceneAuthorityKey === targetSceneAuthorityKey
    ? "settled"
    : "reconcile";
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

/** A pointer press becomes a physics drag only when it first crosses its threshold. */
export function shouldTakeDragPhysicsOwnership(
  wasMoved: boolean,
  moved: boolean
): boolean {
  return !wasMoved && moved;
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
 * Drives a held dynamic body toward the pointer without teleporting it through
 * contacts. Rapier remains free to reduce this desired velocity when another
 * collider blocks the card.
 */
export function getDynamicDragVelocity({
  current,
  maximumSpeed,
  target,
  timeStepSeconds,
}: {
  current: Point3;
  maximumSpeed: number;
  target: Point3;
  timeStepSeconds: number;
}): [x: number, y: number, z: number] {
  const deltaX = target[0] - current[0];
  const deltaY = target[1] - current[1];
  const deltaZ = target[2] - current[2];
  const distance = Math.hypot(deltaX, deltaY, deltaZ);

  if (!Number.isFinite(distance) || distance === 0) {
    return [0, 0, 0];
  }

  const safeTimeStep = Math.max(0.000001, timeStepSeconds);
  const speed = Math.min(
    Math.max(0, maximumSpeed),
    distance / safeTimeStep
  );
  const scale = speed / distance;

  return [deltaX * scale, deltaY * scale, deltaZ * scale];
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

/** Applies a local-Y tilt to the exact physical orientation captured at pickup. */
export function getTiltedCardQuaternion(
  quaternion: QuaternionLike,
  tiltRadians: number
): [x: number, y: number, z: number, w: number] {
  const halfTilt = Number.isFinite(tiltRadians) ? tiltRadians / 2 : 0;
  const sine = Math.sin(halfTilt);
  const cosine = Math.cos(halfTilt);
  const x = quaternion.x * cosine - quaternion.z * sine;
  const y = quaternion.w * sine + quaternion.y * cosine;
  const z = quaternion.x * sine + quaternion.z * cosine;
  const w = quaternion.w * cosine - quaternion.y * sine;
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
  return (
    Math.hypot(Math.max(0, cardWidth), Math.max(0, cardHeight)) +
    Math.max(0, contactSkin) * 2
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
