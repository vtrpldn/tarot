import { Vector3 } from "three";
import { describe, expect, test } from "vitest";
import {
  getMoveReleaseTranslation,
  isFaceOnlyAuthorityChange,
  shouldTakeDragPhysicsOwnership,
} from "./physics-card-drag";

describe("PhysicsCard move release", () => {
  test("restores the captured pose after a click without a drag", () => {
    const start = new Vector3(1.2, -0.4, 0.009);
    const liftedTarget = new Vector3(1.2, -0.4, 0.189);

    expect(getMoveReleaseTranslation(false, start, liftedTarget)).toBe(start);
  });

  test("uses the lifted target after a real drag", () => {
    const start = new Vector3(1.2, -0.4, 0.009);
    const target = new Vector3(-0.8, 0.6, 0.189);

    expect(getMoveReleaseTranslation(true, start, target)).toBe(target);
  });

  test("takes Rapier ownership only when a press becomes a drag", () => {
    expect(shouldTakeDragPhysicsOwnership(false, false)).toBe(false);
    expect(shouldTakeDragPhysicsOwnership(false, true)).toBe(true);
    expect(shouldTakeDragPhysicsOwnership(true, true)).toBe(false);
  });

  test("recognizes a face-only authority change", () => {
    expect(
      isFaceOnlyAuthorityChange(
        { faceUp: false, layerKey: 3, position: [0.4, -0.2], rotation: 15 },
        { faceUp: true, layerKey: 3, position: [0.4, -0.2], rotation: 15 }
      )
    ).toBe(true);
  });

  test("does not classify a move or layer change as a visual-only flip", () => {
    const previous = {
      faceUp: false,
      layerKey: 3,
      position: [0.4, -0.2] as const,
      rotation: 15,
    };

    expect(
      isFaceOnlyAuthorityChange(previous, {
        ...previous,
        faceUp: true,
        position: [0.5, -0.2],
      })
    ).toBe(false);
    expect(
      isFaceOnlyAuthorityChange(previous, {
        ...previous,
        faceUp: true,
        layerKey: 4,
      })
    ).toBe(false);
  });
});
