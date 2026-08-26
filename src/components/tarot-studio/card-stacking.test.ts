import { describe, expect, test } from "vitest";
import type { TableCard } from "@/types";
import type { SceneTableLayout } from "./table-layout";
import {
  getOverlappingTableCardIds,
  getTableCardRestingHeights,
} from "./card-stacking";

const layout = {
  cardHeight: 3,
  cardWidth: 2,
  toWorld: ([x, y]: [number, number]) => [x, y] as [number, number],
} as SceneTableLayout;

function createTableCard(
  id: string,
  position: [number, number],
  zIndex: number
): TableCard {
  return {
    id,
    cardId: id,
    cardSetId: "rider-waite",
    zone: "table",
    position,
    rotation: 0,
    zIndex,
    faceUp: true,
  };
}

describe("getTableCardRestingHeights", () => {
  test("includes the bottom card when an authored overlap needs stabilization", () => {
    const cards = [
      createTableCard("bottom", [0, 0], 1),
      createTableCard("top", [0.05, 0.02], 2),
      createTableCard("separate", [5, 0], 3),
    ];

    expect(
      getOverlappingTableCardIds({
        cards,
        footprint: { halfHeight: 1.45, halfWidth: 0.95 },
        layout,
      })
    ).toEqual(new Set(["bottom", "top"]));
  });

  test("layers intentional collider overlaps by z-index without changing XY", () => {
    const cards = [
      createTableCard("top", [0.08, 0.04], 3),
      createTableCard("bottom", [0, 0], 1),
      createTableCard("middle", [0.04, 0.02], 2),
    ];

    const heights = getTableCardRestingHeights({
      cards,
      footprint: { halfHeight: 1.45, halfWidth: 0.95 },
      layout,
      baseHeight: 0.01,
      layerStep: 0.02,
    });

    expect(heights.get("bottom")).toBe(0.01);
    expect(heights.get("middle")).toBeCloseTo(0.03);
    expect(heights.get("top")).toBeCloseTo(0.05);
    expect(cards.map((card) => card.position)).toEqual([
      [0.08, 0.04],
      [0, 0],
      [0.04, 0.02],
    ]);
  });

  test("keeps cards on the cloth when their colliders do not overlap", () => {
    const heights = getTableCardRestingHeights({
      cards: [
        createTableCard("left", [-3, 0], 1),
        createTableCard("right", [3, 0], 2),
      ],
      footprint: { halfHeight: 1.45, halfWidth: 0.95 },
      layout,
      baseHeight: 0.01,
      layerStep: 0.02,
    });

    expect(heights.get("left")).toBe(0.01);
    expect(heights.get("right")).toBe(0.01);
  });
});
