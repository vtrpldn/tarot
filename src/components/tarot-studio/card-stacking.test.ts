import { describe, expect, test } from "vitest";
import {
  CARD_GEOMETRY,
  CARD_PHYSICS,
  getCardColliderHalfExtents,
} from "@/lib/card-physics";
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
const [halfWidth, halfHeight, halfDepth] = getCardColliderHalfExtents(
  layout.cardWidth,
  layout.cardHeight,
  CARD_GEOMETRY.thickness
);
const footprint = { halfHeight, halfWidth };
const baseHeight = halfDepth + CARD_PHYSICS.contactSkin;
const layerStep = (halfDepth + CARD_PHYSICS.contactSkin) * 2;

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
        footprint,
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
      footprint,
      layout,
      baseHeight,
      layerStep,
    });

    expect(heights.get("bottom")).toBe(0.012);
    expect(heights.get("middle")).toBeCloseTo(0.036);
    expect(heights.get("top")).toBeCloseTo(0.06);
    expect(layerStep - CARD_GEOMETRY.visibleHalfDepth * 2).toBeCloseTo(
      CARD_PHYSICS.contactSkin * 2
    );
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
      footprint,
      layout,
      baseHeight,
      layerStep,
    });

    expect(heights.get("left")).toBe(baseHeight);
    expect(heights.get("right")).toBe(baseHeight);
  });

  test("returns both cards to the cloth when an upper overlap is separated", () => {
    const layeredCards = [
      createTableCard("bottom", [0, 0], 1),
      createTableCard("top", [0.05, 0.02], 2),
    ];
    const separatedCards = [
      layeredCards[0],
      { ...layeredCards[1], position: [2.1, 0] as [number, number] },
    ];

    expect(
      getOverlappingTableCardIds({ cards: layeredCards, footprint, layout })
    ).toEqual(new Set(["bottom", "top"]));
    const layeredHeights = getTableCardRestingHeights({
      cards: layeredCards,
      footprint,
      layout,
      baseHeight,
      layerStep,
    });
    expect(layeredHeights.get("bottom")).toBe(baseHeight);
    expect(layeredHeights.get("top")).toBeCloseTo(baseHeight + layerStep);

    expect(
      getOverlappingTableCardIds({ cards: separatedCards, footprint, layout })
    ).toEqual(new Set());
    const heights = getTableCardRestingHeights({
      cards: separatedCards,
      footprint,
      layout,
      baseHeight,
      layerStep,
    });

    expect(heights.get("bottom")).toBe(baseHeight);
    expect(heights.get("top")).toBe(baseHeight);
  });

  test("does not disturb an independent overlap component when another separates", () => {
    const cards = [
      createTableCard("first-bottom", [0, 0], 1),
      createTableCard("first-top", [0.05, 0.02], 2),
      createTableCard("second-bottom", [5, 0], 3),
      createTableCard("second-top", [5.05, 0.02], 4),
    ];
    const separatedCards = [
      cards[0],
      { ...cards[1], position: [2.1, 0] as [number, number] },
      cards[2],
      cards[3],
    ];
    const options = {
      footprint,
      layout,
      baseHeight,
      layerStep,
    };
    const originalHeights = getTableCardRestingHeights({ cards, ...options });
    const separatedHeights = getTableCardRestingHeights({
      cards: separatedCards,
      ...options,
    });

    expect(originalHeights.get("first-top")).toBeCloseTo(
      baseHeight + layerStep
    );
    expect(originalHeights.get("second-top")).toBeCloseTo(
      baseHeight + layerStep
    );
    expect(
      getOverlappingTableCardIds({
        cards: separatedCards,
        footprint,
        layout,
      })
    ).toEqual(new Set(["second-bottom", "second-top"]));
    expect(separatedHeights.get("first-bottom")).toBe(baseHeight);
    expect(separatedHeights.get("first-top")).toBe(baseHeight);
    expect(separatedHeights.get("second-bottom")).toBe(
      originalHeights.get("second-bottom")
    );
    expect(separatedHeights.get("second-top")).toBe(
      originalHeights.get("second-top")
    );
  });

  test("layers every visual overlap and releases exact edge contact", () => {
    const overlappingCards = [
      createTableCard("left", [0, 0], 1),
      createTableCard("right", [2.011, 0], 2),
    ];
    const touchingCards = [
      createTableCard("left", [0, 0], 1),
      createTableCard("right", [2.012, 0], 2),
    ];

    expect(
      getOverlappingTableCardIds({
        cards: overlappingCards,
        footprint,
        layout,
      })
    ).toEqual(new Set(["left", "right"]));
    const overlappingHeights = getTableCardRestingHeights({
      cards: overlappingCards,
      footprint,
      layout,
      baseHeight,
      layerStep,
    });
    const touchingHeights = getTableCardRestingHeights({
      cards: touchingCards,
      footprint,
      layout,
      baseHeight,
      layerStep,
    });

    expect(overlappingHeights.get("left")).toBe(baseHeight);
    expect(overlappingHeights.get("right")).toBe(baseHeight + layerStep);
    expect(touchingHeights.get("left")).toBe(baseHeight);
    expect(touchingHeights.get("right")).toBe(baseHeight);
  });
});
