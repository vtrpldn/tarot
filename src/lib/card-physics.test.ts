import { describe, expect, test } from "vitest";
import {
  advanceFlipElapsed,
  CARD_GEOMETRY,
  CARD_PHYSICS,
  clampAngularVelocity,
  clampPhysicsPointToBounds,
  constrainReleaseToBounds,
  doesPlanarRayEnterBounds,
  constrainVelocityForNextPhysicsStep,
  createCardQuaternion,
  createPhysicsAuthorityKey,
  flipCardQuaternion,
  getCardColliderHalfExtents,
  getCardPose,
  getFlipVisualState,
  getOffsetCollisionFootprint,
  getReleaseKinematics,
  getSmoothedPointerVelocity,
  hasMeaningfulPoseChange,
  isPhysicsLaunchForMountedCard,
  isPhysicsLaunchForTarget,
  shouldUseDeckClearanceArc,
  normalizeRotation,
} from "./card-physics";

describe("card orientation", () => {
  test.for([
    [0, true],
    [72, true],
    [-145, true],
    [0, false],
    [72, false],
    [-145, false],
  ] as const)("round-trips a %s degree, face-up=%s pose", ([rotation, faceUp]) => {
    const [x, y, z, w] = createCardQuaternion(rotation, faceUp);

    expect(getCardPose({ x: 1.2, y: -0.4 }, { x, y, z, w })).toEqual({
      faceUp,
      position: [1.2, -0.4],
      rotation: expect.closeTo(rotation, 10),
    });
  });

  test.for([
    [0, true],
    [72, true],
    [-145, true],
    [0, false],
    [72, false],
    [-145, false],
  ] as const)("flips a %s degree, face-up=%s pose without changing yaw", ([rotation, faceUp]) => {
    const [x, y, z, w] = createCardQuaternion(rotation, faceUp);
    const [nextX, nextY, nextZ, nextW] = flipCardQuaternion({ x, y, z, w });
    const pose = getCardPose(
      { x: 0, y: 0 },
      { x: nextX, y: nextY, z: nextZ, w: nextW }
    );

    expect(pose.faceUp).toBe(!faceUp);
    expect(pose.rotation).toBeCloseTo(rotation, 10);
  });

  test.for([
    [540, -180],
    [360, 0],
    [-450, -90],
    [Number.NaN, 0],
  ] as const)("normalizes %s degrees to %s", ([rotation, expected]) => {
    expect(normalizeRotation(rotation)).toBe(expected);
  });
});

describe("card release", () => {
  test("only preserves a launch arc for a ray that reaches the deck footprint", () => {
    const bounds = { bottom: -1, left: -1, right: 1, top: 1 };

    expect(
      doesPlanarRayEnterBounds({
        bounds,
        origin: [3, 0],
        velocity: [-4.2, 0],
      })
    ).toBe(true);
    expect(
      doesPlanarRayEnterBounds({
        bounds,
        origin: [3, 0],
        velocity: [0, 4.2],
      })
    ).toBe(false);
  });

  test("keeps a slow deckward push in contact with the deck edge", () => {
    const bounds = { bottom: -1, left: -1, right: 1, top: 1 };
    const fastThrow = getReleaseKinematics({
      grabOffset: [0, 0],
      pointerVelocity: [-CARD_PHYSICS.maxPlanarSpeed, 0],
      reducedMotion: false,
    });
    const slowPush = getReleaseKinematics({
      grabOffset: [0, 0],
      pointerVelocity: [-1.2, 0],
      reducedMotion: false,
    });

    expect(
      shouldUseDeckClearanceArc({
        bounds,
        kinematics: fastThrow,
        origin: [3, 0],
      })
    ).toBe(true);
    expect(
      shouldUseDeckClearanceArc({
        bounds,
        kinematics: slowPush,
        origin: [3, 0],
      })
    ).toBe(false);
    expect(
      shouldUseDeckClearanceArc({
        bounds,
        kinematics: fastThrow,
        origin: [-3, 0],
      })
    ).toBe(false);
  });

  test("retains flick momentum through 50-64ms final pointer samples", () => {
    const fastSample = getSmoothedPointerVelocity({
      delta: [0.2, 0],
      elapsedSeconds: 0.016,
      maxSpeed: 8,
      previousVelocity: [0, 0],
    });
    const finalSamples = [0.05, 0.064].map((elapsedSeconds) =>
      getSmoothedPointerVelocity({
        delta: [0.004, 0],
        elapsedSeconds,
        maxSpeed: 8,
        previousVelocity: fastSample,
      })
    );

    expect(fastSample[0]).toBeGreaterThan(3);
    finalSamples.forEach((finalSample) => {
      expect(finalSample[0]).toBeGreaterThan(1);
      expect(finalSample[0]).toBeLessThan(fastSample[0]);
      expect(finalSample[1]).toBe(0);
    });
  });

  test("discards stale flick momentum after a pointer pause", () => {
    const fastSample = getSmoothedPointerVelocity({
      delta: [0.2, 0],
      elapsedSeconds: 0.016,
      maxSpeed: 8,
      previousVelocity: [0, 0],
    });
    const afterPause = getSmoothedPointerVelocity({
      delta: [0.004, 0],
      elapsedSeconds: 1,
      maxSpeed: 8,
      previousVelocity: fastSample,
    });

    expect(afterPause[0]).toBeCloseTo(0.0625, 4);
    expect(afterPause[1]).toBe(0);
  });

  test("keeps a dragged card centre inside the table boundary", () => {
    const bounds = { bottom: -2, left: -3, right: 3, top: 2 };

    expect(clampPhysicsPointToBounds([8, -9], bounds)).toEqual([3, -2]);
    expect(clampPhysicsPointToBounds([1.5, 0.75], bounds)).toEqual([
      1.5,
      0.75,
    ]);
  });

  test("caps planar speed while preserving its direction", () => {
    const release = getReleaseKinematics({
      grabOffset: [0, 0],
      pointerVelocity: [30, 40],
      reducedMotion: false,
    });

    expect(Math.hypot(...release.linearVelocity.slice(0, 2))).toBeCloseTo(
      CARD_PHYSICS.maxPlanarSpeed
    );
    expect(release.linearVelocity[0] / release.linearVelocity[1]).toBeCloseTo(
      30 / 40
    );
  });

  test("adds a bounded upward arc only to intentional fast flicks", () => {
    const slowRelease = getReleaseKinematics({
      grabOffset: [0, 0],
      pointerVelocity: [CARD_PHYSICS.throwArcMinimumPlanarSpeed - 0.01, 0],
      reducedMotion: false,
    });
    const fastRelease = getReleaseKinematics({
      grabOffset: [0, 0],
      pointerVelocity: [CARD_PHYSICS.maxPlanarSpeed, 0],
      reducedMotion: false,
    });
    const cappedRelease = getReleaseKinematics({
      grabOffset: [0, 0],
      pointerVelocity: [CARD_PHYSICS.maxPlanarSpeed * 10, 0],
      reducedMotion: false,
    });

    expect(slowRelease.linearVelocity[2]).toBe(0);
    expect(fastRelease.linearVelocity[2]).toBe(
      CARD_PHYSICS.throwArcMaximumVerticalSpeed
    );
    expect(cappedRelease.linearVelocity[2]).toBe(
      CARD_PHYSICS.throwArcMaximumVerticalSpeed
    );
  });

  test("derives opposite yaw from opposite off-centre throws", () => {
    const clockwise = getReleaseKinematics({
      grabOffset: [0.3, 0],
      pointerVelocity: [0, 2],
      reducedMotion: false,
    });
    const counterClockwise = getReleaseKinematics({
      grabOffset: [-0.3, 0],
      pointerVelocity: [0, 2],
      reducedMotion: false,
    });

    expect(clockwise.angularVelocity[2]).toBeGreaterThan(0);
    expect(counterClockwise.angularVelocity[2]).toBeLessThan(0);
  });

  test("caps off-centre spin without reducing planar flick inertia", () => {
    const centered = getReleaseKinematics({
      grabOffset: [0, 0],
      pointerVelocity: [0, CARD_PHYSICS.maxPlanarSpeed],
      reducedMotion: false,
    });
    const edgeGrab = getReleaseKinematics({
      grabOffset: [3, 0],
      pointerVelocity: [0, CARD_PHYSICS.maxPlanarSpeed],
      reducedMotion: false,
    });

    expect(edgeGrab.linearVelocity).toEqual(centered.linearVelocity);
    expect(edgeGrab.angularVelocity[2]).toBe(CARD_PHYSICS.maxAngularSpeed);
    expect(Math.abs(edgeGrab.angularVelocity[2])).toBeLessThanOrEqual(6);
  });

  test("caps collision-added angular velocity while retaining its direction", () => {
    const capped = clampAngularVelocity([3, -4, 12]);

    expect(Math.hypot(...capped)).toBeCloseTo(CARD_PHYSICS.maxAngularSpeed);
    expect(capped[0] / capped[1]).toBeCloseTo(3 / -4);
    expect(capped[2]).toBeGreaterThan(0);
  });

  test("removes release momentum for reduced motion", () => {
    expect(
      getReleaseKinematics({
        grabOffset: [0.4, -0.2],
        pointerVelocity: [4, 3],
        reducedMotion: true,
      })
    ).toEqual({
      angularVelocity: [0, 0, 0],
      linearVelocity: [0, 0, 0],
    });
  });

  test("removes only momentum that points out of the table", () => {
    expect(
      constrainReleaseToBounds({
        bounds: { bottom: -2, left: -3, right: 3, top: 2 },
        kinematics: {
          angularVelocity: [0, 0, 2],
          linearVelocity: [4, 1.5, 0],
        },
        position: [3, 0],
      })
    ).toEqual({
      angularVelocity: [0, 0, 2],
      linearVelocity: [0, 1.5, 0],
    });
  });

  test("brakes the next solver step at the durable centre boundary", () => {
    expect(
      constrainVelocityForNextPhysicsStep({
        bounds: { bottom: -2, left: -3, right: 3, top: 2 },
        position: [2.99, -1.99],
        timeStepSeconds: 1 / 60,
        velocity: [4.2, -4.2, 1.45],
      })
    ).toEqual([expect.closeTo(0.6, 8), expect.closeTo(-0.6, 8), 1.45]);

    expect(
      constrainVelocityForNextPhysicsStep({
        bounds: { bottom: -2, left: -3, right: 3, top: 2 },
        position: [2.99, 0],
        timeStepSeconds: 1 / 60,
        velocity: [-4.2, 0, 0],
      })
    ).toEqual([-4.2, 0, 0]);
  });
});

describe("controlled flip presentation", () => {
  test("does not consume a long idle gap as one flip frame", () => {
    expect(
      advanceFlipElapsed({
        durationSeconds: 0.42,
        elapsedSeconds: 0,
        frameDeltaSeconds: 5,
        reducedMotion: false,
      })
    ).toBeCloseTo(1 / 30);
    expect(
      advanceFlipElapsed({
        durationSeconds: 0.42,
        elapsedSeconds: 0,
        frameDeltaSeconds: 5,
        reducedMotion: true,
      })
    ).toBe(0.42);
  });

  test("squeezes horizontally and swaps faces only while edge-on", () => {
    expect(getFlipVisualState(0)).toEqual({
      rotationY: 0,
      scaleX: 1,
      scaleY: 1,
    });
    expect(getFlipVisualState(0.5)).toEqual({
      rotationY: Math.PI,
      scaleX: 0,
      scaleY: 1,
    });
    expect(getFlipVisualState(1)).toEqual({
      rotationY: Math.PI,
      scaleX: 1,
      scaleY: 1,
    });
  });

  test("never expands outside the physical card envelope", () => {
    for (let step = 0; step <= 120; step += 1) {
      const state = getFlipVisualState(step / 120);

      expect([0, Math.PI]).toContain(state.rotationY);
      expect(state.scaleX).toBeGreaterThanOrEqual(0);
      expect(state.scaleX).toBeLessThanOrEqual(1);
      expect(state.scaleY).toBe(1);
    }
  });

  test("keeps the face swap hidden across more than one maximum demand frame", () => {
    for (const progress of [0.46, 0.5, 0.54]) {
      expect(getFlipVisualState(progress).scaleX).toBe(0);
    }
  });
});

describe("card collider and persistence tolerances", () => {
  test("contains the complete rounded visual slab", () => {
    expect(getCardColliderHalfExtents(2, 3, 0.018)).toEqual([
      1.006,
      1.506,
      0.011,
    ]);
    expect(CARD_GEOMETRY.visibleHalfDepth).toBe(0.011);
  });

  test("contains every offset card in a cascaded deck footprint", () => {
    const offsets: Array<[number, number]> = [
      [-0.2, 0.1],
      [0.3, -0.4],
    ];
    const footprint = getOffsetCollisionFootprint({
      halfHeight: 1.756,
      halfWidth: 1.006,
      offsets,
    });

    expect(footprint.centerOffset).toEqual([
      expect.closeTo(0.05),
      expect.closeTo(-0.15),
    ]);
    expect(footprint.halfWidth).toBeCloseTo(1.256);
    expect(footprint.halfHeight).toBeCloseTo(2.006);

    for (const [x, y] of offsets) {
      expect(Math.abs(x - footprint.centerOffset[0]) + 1.006).toBeLessThanOrEqual(
        footprint.halfWidth
      );
      expect(Math.abs(y - footprint.centerOffset[1]) + 1.756).toBeLessThanOrEqual(
        footprint.halfHeight
      );
    }
  });

  test("ignores solver noise but keeps user-visible pose changes", () => {
    const current = {
      faceUp: true,
      position: [1, 1] as [number, number],
      rotation: 10,
    };

    expect(
      hasMeaningfulPoseChange(current, {
        faceUp: true,
        position: [1.0004, 0.9996],
        rotation: 10.03,
      })
    ).toBe(false);
    expect(
      hasMeaningfulPoseChange(current, {
        faceUp: false,
        position: [1, 1],
        rotation: 10,
      })
    ).toBe(true);
  });

  test("keys settled poses to the current durable card revision", () => {
    const pose = {
      faceUp: true,
      position: [0.25, -0.5] as [number, number],
      rotation: 360,
      zIndex: 7,
    };

    expect(createPhysicsAuthorityKey(pose)).toBe("1:0.25:-0.5:0:7");
    expect(
      createPhysicsAuthorityKey({ ...pose, zIndex: pose.zIndex + 1 })
    ).not.toBe(createPhysicsAuthorityKey(pose));
  });

  test("accepts a one-shot launch only for its durable draw target", () => {
    const launch = {
      id: 7,
      angularVelocity: [0, 0, 1] as [number, number, number],
      faceUp: false,
      linearVelocity: [2, 0, 0] as [number, number, number],
      position: [-1, 0, 0.2] as [number, number, number],
      rotation: 18,
      targetPosition: [0.5, -0.25] as [number, number],
    };

    expect(isPhysicsLaunchForTarget(launch, [0.5, -0.25])).toBe(true);
    expect(isPhysicsLaunchForTarget(launch, [0.7, -0.25])).toBe(false);
    expect(
      isPhysicsLaunchForMountedCard(launch, "table", [0.5, -0.25])
    ).toBe(true);
  });

  test("invalidates a same-target launch when undo returns its card to the deck", () => {
    const launch = {
      id: 8,
      angularVelocity: [0, 0, 1] as [number, number, number],
      faceUp: true,
      linearVelocity: [2, 0, 0] as [number, number, number],
      position: [-1, 0, 0.2] as [number, number, number],
      rotation: -24,
      targetPosition: [0.5, -0.25] as [number, number],
    };

    expect(
      isPhysicsLaunchForMountedCard(launch, "deck", [0.5, -0.25])
    ).toBe(false);
  });
});
