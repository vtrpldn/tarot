type CardUvPoint = { x: number; y: number };

type QuaternionLike = {
  w: number;
  x: number;
  y: number;
  z: number;
};

export type FlipHandoffAction = "animate" | "commit" | "reset";
export type FlipHandoffResolution = "flip" | "reconcile" | "settled";

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
