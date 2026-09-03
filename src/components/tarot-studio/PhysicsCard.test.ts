import { describe, expect, test } from "vitest";
import {
  canPersistSettledPhysicsPose,
  createPhysicsSceneAuthorityKey,
  getCardPickupHeight,
  getDynamicDragForce,
  getElevationCueLean,
  getElevationTiltGesture,
  getKinematicDragStep,
  getLayerTransitionClearance,
  getLayerTransitionOffset,
  getLayerTransitionPosition,
  getLocalOffsetForWorldUp,
  getMoveDragForce,
  getTiltedCardQuaternion,
  isFlipTargetCurrent,
  isFaceOnlyAuthorityChange,
  isNearCardRotationCorner,
  shouldStabilizeRestingLayer,
  shouldApplyLayerTransitionTargetRotation,
  shouldSuppressCardContextMenu,
  shouldTakeDragPhysicsOwnership,
} from "./physics-card-drag";

describe("PhysicsCard move release", () => {
  test("accepts a moving body's flip while the user authority stays current", () => {
    expect(
      isFlipTargetCurrent({
        latestFaceUp: false,
        latestSceneAuthorityKey: "face-down-at-release",
        targetFaceUp: false,
        targetSceneAuthorityKey: "face-down-at-release",
      })
    ).toBe(true);
    expect(
      isFlipTargetCurrent({
        latestFaceUp: false,
        latestSceneAuthorityKey: "moved-during-flip",
        targetFaceUp: false,
        targetSceneAuthorityKey: "face-down-at-release",
      })
    ).toBe(false);
    expect(
      isFlipTargetCurrent({
        latestFaceUp: true,
        latestSceneAuthorityKey: "face-up-again",
        targetFaceUp: false,
        targetSceneAuthorityKey: "face-down-at-release",
      })
    ).toBe(false);
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

  test.each(["move", "rotate", "elevate-tilt"] as const)(
    "%s takes physics ownership once, with immediate pickup only for a move press",
    (mode) => {
      expect(shouldTakeDragPhysicsOwnership({
        hasPhysicsOwnership: false,
        mode,
        moved: false,
      })).toBe(mode === "move");
      expect(shouldTakeDragPhysicsOwnership({
        hasPhysicsOwnership: false,
        mode,
        moved: true,
      })).toBe(true);
      for (const moved of [false, true]) {
        expect(shouldTakeDragPhysicsOwnership({
          hasPhysicsOwnership: true,
          mode,
          moved,
        })).toBe(false);
      }
    }
  );

  test("picks up above the current physical or authored layer, whichever is higher", () => {
    expect(getCardPickupHeight(0.02, 0.02)).toBeCloseTo(0.2);
    expect(getCardPickupHeight(0.3, 0.1)).toBeCloseTo(0.48);
    expect(getCardPickupHeight(0.1, 0.3)).toBeCloseTo(0.48);
  });

  test("still lifts against gravity when a fast pointer move pulls sideways", () => {
    const mass = 0.0018;
    const [forceX, , forceZ] = getMoveDragForce({
      current: [0, 0, 0.02],
      mass,
      target: [3, 0, getCardPickupHeight(0.02, 0.02)],
      velocity: [0, 0, 0],
    });

    expect(forceX).toBeGreaterThan(0);
    expect(forceX / mass).toBeLessThanOrEqual(46);
    expect(forceZ / mass).toBeGreaterThan(9.81);
  });

  test("suppresses the card context menu before right-drag movement begins", () => {
    expect(
      shouldSuppressCardContextMenu({
        hasActiveRightGesture: true,
        now: 100,
        suppressionDeadline: 0,
      })
    ).toBe(true);
    expect(
      shouldSuppressCardContextMenu({
        hasActiveRightGesture: false,
        now: 100,
        suppressionDeadline: 600,
      })
    ).toBe(true);
    expect(
      shouldSuppressCardContextMenu({
        hasActiveRightGesture: false,
        now: 601,
        suppressionDeadline: 600,
      })
    ).toBe(false);
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

  test("pulls a held card with bounded force without cancelling vertical motion", () => {
    expect(
      getDynamicDragForce({
        controlHeight: false,
        current: [0, 0, 0.01],
        mass: 0.0018,
        maximumAcceleration: 28,
        maximumSpeed: 4.8,
        response: 12,
        target: [2, 0, 0.016],
        velocity: [0, 0, -1.5],
      })
    ).toEqual([expect.closeTo(0.0504), 0, 0]);
    expect(
      getDynamicDragForce({
        controlHeight: true,
        current: [0, 0, 0],
        mass: 0.0018,
        maximumAcceleration: 28,
        maximumSpeed: 4.8,
        response: 12,
        target: [0, 0, 0.25],
        velocity: [0, 0, 0],
      })
    ).toEqual([0, 0, expect.closeTo(0.0504)]);
  });

  test("maps right-drag axes independently to height and physical tilt", () => {
    expect(
      getElevationTiltGesture({
        current: [0, 0.5],
        elevationScale: 0.8,
        maximumElevation: 1.1,
        maximumTiltRadians: 0.5,
        minimumElevation: 0.01,
        origin: [0, 0],
        startElevation: 0.01,
        tiltScale: 0.5,
      })
    ).toEqual({ elevation: 0.41000000000000003, tiltRadians: 0 });
    expect(
      getElevationTiltGesture({
        current: [2, -2],
        elevationScale: 0.8,
        maximumElevation: 1.1,
        maximumTiltRadians: 0.5,
        minimumElevation: 0.01,
        origin: [0, 0],
        startElevation: 0.4,
        tiltScale: 0.5,
      })
    ).toEqual({ elevation: 0.01, tiltRadians: 0.5 });
  });

  test("turns vertical elevation into a readable physical lean", () => {
    const lean = getElevationCueLean({
      elevation: 0.56,
      maximumElevationDelta: 1.1,
      maximumLeanRadians: Math.PI / 18,
      startElevation: 0.01,
    });
    const tilted = getTiltedCardQuaternion(
      { w: 1, x: 0, y: 0, z: 0 },
      0,
      lean
    );

    expect(lean).toBeCloseTo(Math.PI / 36);
    expect(Math.abs(tilted[0])).toBeGreaterThan(0.04);
    expect(tilted[1]).toBeCloseTo(0);
    expect(Math.hypot(...tilted)).toBeCloseTo(1);
  });

  test("tilts from the captured physical orientation without changing its norm", () => {
    const tilted = getTiltedCardQuaternion(
      { w: 1, x: 0, y: 0, z: 0 },
      Math.PI / 6
    );

    expect(tilted).toEqual([
      0,
      expect.closeTo(Math.sin(Math.PI / 12)),
      0,
      expect.closeTo(Math.cos(Math.PI / 12)),
    ]);
    expect(Math.hypot(...tilted)).toBeCloseTo(1);
  });

  test("restacks sideways before changing height and returns to authored XY", () => {
    const start = [0, 0, 0.01] as const;
    const target = [0, 0, 0.03] as const;

    expect(
      getLayerTransitionPosition({
        lift: 0.12,
        offset: [1.5, 0],
        progress: 0,
        start,
        target,
      })
    ).toEqual([0, 0, 0.01]);
    expect(
      getLayerTransitionPosition({
        lift: 0.12,
        offset: [1.5, 0],
        progress: 0.2,
        start,
        target,
      })[2]
    ).toBe(0.01);
    expect(
      getLayerTransitionPosition({
        lift: 0.12,
        offset: [1.5, 0],
        progress: 0.5,
        start,
        target,
      })
    ).toEqual([1.5, 0, expect.closeTo(0.08)]);
    expect(
      getLayerTransitionPosition({
        lift: 0.12,
        offset: [1.5, 0],
        progress: 1,
        start,
        target,
      })
    ).toEqual([0, 0, 0.03]);
  });

  test("waits for full lateral clearance before applying authored yaw", () => {
    expect(shouldApplyLayerTransitionTargetRotation(0.349)).toBe(false);
    expect(shouldApplyLayerTransitionTargetRotation(0.35)).toBe(true);
    expect(shouldApplyLayerTransitionTargetRotation(1)).toBe(true);
  });

  test("turns a layer transition inward when its preferred lane reaches the rail", () => {
    const bounds = { bottom: -5, left: -5, right: 5, top: 5 };

    expect(
      getLayerTransitionOffset({
        bounds,
        clearance: 4,
        layerDirection: 1,
        start: [0, 0],
      })
    ).toEqual([4, 0]);
    expect(
      getLayerTransitionOffset({
        bounds,
        clearance: 4,
        layerDirection: 1,
        start: [4.5, 0],
      })
    ).toEqual([-4, 0]);
    expect(
      getLayerTransitionOffset({
        bounds,
        clearance: 4,
        layerDirection: -1,
        start: [0, -4.5],
      })
    ).toEqual([0, 4]);
  });

  test("uses a full card diagonal to clear arbitrary layer rotation", () => {
    expect(
      getLayerTransitionClearance({
        cardHeight: 3.5,
        cardWidth: 2,
        contactSkin: 0.001,
      })
    ).toBeCloseTo(2 * Math.hypot(1.007, 1.757));
  });

  test("reconciles when a passive card leaves authored overlap mode", () => {
    const common = {
      authorityKey: "face:0:0:0:1",
      position: [0, 0] as const,
      restingZ: 0.01,
      tableSurfaceZ: 0,
    };

    expect(
      createPhysicsSceneAuthorityKey({
        ...common,
        stabilizeAtRest: true,
      })
    ).not.toBe(
      createPhysicsSceneAuthorityKey({
        ...common,
        stabilizeAtRest: false,
      })
    );
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
