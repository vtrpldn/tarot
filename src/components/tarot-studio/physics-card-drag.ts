import type { Vector3 } from "three";

/** Keeps a press/click at its captured physical pose instead of the drag lift. */
export function getMoveReleaseTranslation(
  moved: boolean,
  startTranslation: Vector3,
  target: Vector3
): Vector3 {
  return moved ? target : startTranslation;
}

/** A pointer press becomes a physics drag only when it first crosses its threshold. */
export function shouldTakeDragPhysicsOwnership(
  wasMoved: boolean,
  moved: boolean
): boolean {
  return !wasMoved && moved;
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
