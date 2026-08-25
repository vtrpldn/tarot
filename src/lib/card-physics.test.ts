import { describe, expect, test } from "vitest";
import {
  CARD_PHYSICS,
  clampPhysicsPointToBounds,
  createCardQuaternion,
  createPhysicsAuthorityKey,
  getCardColliderHalfExtents,
  getCardPose,
  getReleaseKinematics,
  hasMeaningfulPoseChange,
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
    [540, -180],
    [360, 0],
    [-450, -90],
    [Number.NaN, 0],
  ] as const)("normalizes %s degrees to %s", ([rotation, expected]) => {
    expect(normalizeRotation(rotation)).toBe(expected);
  });
});

describe("card release", () => {
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
});

describe("card collider and persistence tolerances", () => {
  test("keeps the collider inside the rounded visual slab", () => {
    expect(getCardColliderHalfExtents(2, 3, 0.018)).toEqual([
      0.975,
      1.475,
      0.009,
    ]);
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
});
