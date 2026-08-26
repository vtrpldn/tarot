import { describe, expect, test } from "vitest";
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
} from "./physics-card-drag";

describe("PhysicsCard move release", () => {
  test("keeps the completed visual turn through the physical flip handoff frame", () => {
    expect(
      getFlipHandoffAction({ handoffPending: false, visualComplete: false })
    ).toBe("animate");
    expect(
      getFlipHandoffAction({ handoffPending: false, visualComplete: true })
    ).toBe("commit");
    expect(
      getFlipHandoffAction({ handoffPending: true, visualComplete: true })
    ).toBe("reset");
  });

  test("replays face and full-pose commands that arrive during handoff", () => {
    expect(
      getFlipHandoffResolution({
        currentFaceUp: true,
        currentSceneAuthorityKey: "face-down",
        targetFaceUp: false,
        targetSceneAuthorityKey: "face-up-again",
      })
    ).toBe("flip");
    expect(
      getFlipHandoffResolution({
        currentFaceUp: true,
        currentSceneAuthorityKey: "rotation-0",
        targetFaceUp: true,
        targetSceneAuthorityKey: "rotation-15",
      })
    ).toBe("reconcile");
    expect(
      getFlipHandoffResolution({
        currentFaceUp: true,
        currentSceneAuthorityKey: "settled",
        targetFaceUp: true,
        targetSceneAuthorityKey: "settled",
      })
    ).toBe("settled");
  });

  test("converts the visible drag lift to world-up for either face and a tilt", () => {
    expect(
      getLocalOffsetForWorldUp({
        distance: 0.174,
        quaternion: { w: 1, x: 0, y: 0, z: 0 },
      })
    ).toEqual([0, 0, 0.174]);
    expect(
      getLocalOffsetForWorldUp({
        distance: 0.174,
        quaternion: { w: 0, x: 0, y: 1, z: 0 },
      })
    ).toEqual([0, 0, -0.174]);
    expect(
      getLocalOffsetForWorldUp({
        distance: 0.174,
        quaternion: {
          w: Math.SQRT1_2,
          x: Math.SQRT1_2,
          y: 0,
          z: 0,
        },
      })
    ).toEqual([0, expect.closeTo(0.174), expect.closeTo(0)]);
  });

  test("takes Rapier ownership only when a press becomes a drag", () => {
    expect(shouldTakeDragPhysicsOwnership(false, false)).toBe(false);
    expect(shouldTakeDragPhysicsOwnership(false, true)).toBe(true);
    expect(shouldTakeDragPhysicsOwnership(true, true)).toBe(false);
  });

  test("limits a coalesced kinematic pointer sweep to a contact-safe step", () => {
    expect(
      getKinematicDragStep({
        current: [-2, 0, 0.01],
        maximumDistance: 8 / 60,
        target: [2, 0, 0.016],
      })
    ).toEqual([expect.closeTo(-2 + 8 / 60), 0, expect.closeTo(0.0102)]);
  });

  test("stabilizes every authored overlap layer, including its bottom", () => {
    expect(
      shouldStabilizeRestingLayer({
        hasAuthoredOverlap: true,
        hasLaunch: false,
        minimumRestingZ: 0.01,
        restingZ: 0.01,
      })
    ).toBe(true);
    expect(
      shouldStabilizeRestingLayer({
        hasAuthoredOverlap: false,
        hasLaunch: false,
        minimumRestingZ: 0.01,
        restingZ: 0.03,
      })
    ).toBe(false);
    expect(
      shouldStabilizeRestingLayer({
        hasAuthoredOverlap: false,
        hasLaunch: false,
        minimumRestingZ: 0.01,
        restingZ: 0.01,
      })
    ).toBe(false);
    expect(
      shouldStabilizeRestingLayer({
        hasAuthoredOverlap: true,
        hasLaunch: true,
        minimumRestingZ: 0.01,
        restingZ: 0.03,
      })
    ).toBe(false);
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
