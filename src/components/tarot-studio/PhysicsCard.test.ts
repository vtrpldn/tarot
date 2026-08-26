import { Vector3 } from "three";
import { describe, expect, test } from "vitest";
import {
  canPersistSettledPhysicsPose,
  getMoveReleaseTranslation,
  isFaceOnlyAuthorityChange,
  isNearCardRotationCorner,
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

  test("persists a sleeping card after its visual flip completes", () => {
    const authority = "1:0.4:-0.2:15:3";

    // Rapier's onSleep path must reject the in-flight visual phase.
    expect(
      canPersistSettledPhysicsPose({
        hasActiveDrag: false,
        hasActiveFlip: true,
        hasExternalDrag: false,
        latestSceneAuthorityKey: authority,
        reconciledAuthorityKey: authority,
        reconciledSceneAuthorityKey: authority,
      })
    ).toBe(false);

    // Completion clears the visual owner and can commit the same sleeping
    // body's final pose through the matching authority key.
    expect(
      canPersistSettledPhysicsPose({
        hasActiveDrag: false,
        hasActiveFlip: false,
        hasExternalDrag: false,
        latestSceneAuthorityKey: authority,
        reconciledAuthorityKey: authority,
        reconciledSceneAuthorityKey: authority,
      })
    ).toBe(true);
  });

  test("reserves corners for rotation without stealing ordinary edge drags", () => {
    expect(isNearCardRotationCorner({ x: 0.04, y: 0.05 }, 0.14)).toBe(
      true
    );
    expect(isNearCardRotationCorner({ x: 0.04, y: 0.5 }, 0.14)).toBe(
      false
    );
    expect(isNearCardRotationCorner({ x: 0.5, y: 0.5 }, 0.14)).toBe(
      false
    );
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
