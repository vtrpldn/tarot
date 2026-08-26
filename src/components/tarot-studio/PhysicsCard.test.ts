import { Vector3 } from "three";
import { describe, expect, test } from "vitest";
import { getMoveReleaseTranslation } from "./physics-card-drag";

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
});
