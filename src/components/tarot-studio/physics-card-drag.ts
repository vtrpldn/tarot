import type { Vector3 } from "three";

/** Keeps a press/click at its captured physical pose instead of the drag lift. */
export function getMoveReleaseTranslation(
  moved: boolean,
  startTranslation: Vector3,
  target: Vector3
): Vector3 {
  return moved ? target : startTranslation;
}
