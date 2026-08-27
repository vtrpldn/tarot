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

  test("returns both cards to the cloth when an upper overlap is separated", () => {
    const footprint = { halfHeight: 1.45, halfWidth: 0.95 };
    const layeredCards = [
      createTableCard("bottom", [0, 0], 1),
      createTableCard("top", [0.05, 0.02], 2),
    ];
    const separatedCards = [
      layeredCards[0],
      { ...layeredCards[1], position: [2, 0] as [number, number] },
    ];

    expect(
      getOverlappingTableCardIds({ cards: layeredCards, footprint, layout })
    ).toEqual(new Set(["bottom", "top"]));
    const layeredHeights = getTableCardRestingHeights({
      cards: layeredCards,
      footprint,
      layout,
      baseHeight: 0.01,
      layerStep: 0.02,
    });
    expect(layeredHeights.get("bottom")).toBe(0.01);
    expect(layeredHeights.get("top")).toBeCloseTo(0.03);

    expect(
      getOverlappingTableCardIds({ cards: separatedCards, footprint, layout })
    ).toEqual(new Set());
    const heights = getTableCardRestingHeights({
      cards: separatedCards,
      footprint,
      layout,
      baseHeight: 0.01,
      layerStep: 0.02,
    });

    expect(heights.get("bottom")).toBe(0.01);
    expect(heights.get("top")).toBe(0.01);
  });

  test("does not disturb an independent overlap component when another separates", () => {
    const footprint = { halfHeight: 1.45, halfWidth: 0.95 };
    const cards = [
      createTableCard("first-bottom", [0, 0], 1),
      createTableCard("first-top", [0.05, 0.02], 2),
      createTableCard("second-bottom", [5, 0], 3),
      createTableCard("second-top", [5.05, 0.02], 4),
    ];
    const separatedCards = [
      cards[0],
      { ...cards[1], position: [2, 0] as [number, number] },
      cards[2],
      cards[3],
    ];
    const options = {
      footprint,
      layout,
      baseHeight: 0.01,
      layerStep: 0.02,
    };
    const originalHeights = getTableCardRestingHeights({ cards, ...options });
    const separatedHeights = getTableCardRestingHeights({
      cards: separatedCards,
      ...options,
    });

    expect(originalHeights.get("first-top")).toBeCloseTo(0.03);
    expect(originalHeights.get("second-top")).toBeCloseTo(0.03);
    expect(
      getOverlappingTableCardIds({
        cards: separatedCards,
        footprint,
        layout,
      })
    ).toEqual(new Set(["second-bottom", "second-top"]));
    expect(separatedHeights.get("first-bottom")).toBe(0.01);
    expect(separatedHeights.get("first-top")).toBe(0.01);
    expect(separatedHeights.get("second-bottom")).toBe(
      originalHeights.get("second-bottom")
    );
    expect(separatedHeights.get("second-top")).toBe(
      originalHeights.get("second-top")
    );
  });

  test("treats an exact overlap-epsilon edge as separated", () => {
    const footprint = { halfHeight: 1.45, halfWidth: 0.95 };
    const cards = [
      createTableCard("left", [0, 0], 1),
      // Two half-widths minus the strict 0.001 overlap epsilon: equality here
      // must release the authored layer rather than retain a phantom stack.
      createTableCard("right", [1.899, 0], 2),
    ];

    expect(
      getOverlappingTableCardIds({ cards, footprint, layout })
    ).toEqual(new Set());
    const heights = getTableCardRestingHeights({
      cards,
      footprint,
      layout,
      baseHeight: 0.01,
      layerStep: 0.02,
    });

    expect(heights.get("left")).toBe(0.01);
    expect(heights.get("right")).toBe(0.01);
  });
});
