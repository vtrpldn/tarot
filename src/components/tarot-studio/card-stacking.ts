import type { TableCard } from "@/types";
import type { SceneTableLayout } from "./table-layout";

type Axis = [number, number];

type RotatedCard = {
  center: [number, number];
  axes: [Axis, Axis];
};

function dot(first: Axis, second: Axis): number {
  return first[0] * second[0] + first[1] * second[1];
}

function createRotatedCard(
  card: TableCard,
  layout: SceneTableLayout
): RotatedCard {
  const radians = (card.rotation * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);

  return {
    center: layout.toWorld(card.position),
    axes: [
      [cosine, sine],
      [-sine, cosine],
    ],
  };
}

function projectionRadius(
  card: RotatedCard,
  axis: Axis,
  halfWidth: number,
  halfHeight: number
): number {
  return (
    halfWidth * Math.abs(dot(card.axes[0], axis)) +
    halfHeight * Math.abs(dot(card.axes[1], axis))
  );
}

function cardsOverlap(
  first: RotatedCard,
  second: RotatedCard,
  halfWidth: number,
  halfHeight: number
): boolean {
  const centerDelta: Axis = [
    second.center[0] - first.center[0],
    second.center[1] - first.center[1],
  ];

  return [...first.axes, ...second.axes].every((axis) => {
    const centerDistance = Math.abs(dot(centerDelta, axis));
    const combinedRadius =
      projectionRadius(first, axis, halfWidth, halfHeight) +
      projectionRadius(second, axis, halfWidth, halfHeight);

    return centerDistance < combinedRadius - 0.001;
  });
}

export function getTableCardRestingHeights({
  cards,
  layout,
  baseHeight,
  layerStep,
}: {
  cards: TableCard[];
  layout: SceneTableLayout;
  baseHeight: number;
  layerStep: number;
}): Map<string, number> {
  const restingHeights = new Map<string, number>();
  const footprints = cards.map((card) => createRotatedCard(card, layout));
  const halfWidth = layout.cardWidth / 2;
  const halfHeight = layout.cardHeight / 2;

  cards.forEach((card, index) => {
    let restingHeight = baseHeight;

    for (let lowerIndex = 0; lowerIndex < index; lowerIndex += 1) {
      if (
        cardsOverlap(
          footprints[index],
          footprints[lowerIndex],
          halfWidth,
          halfHeight
        )
      ) {
        restingHeight = Math.max(
          restingHeight,
          (restingHeights.get(cards[lowerIndex].id) ?? baseHeight) +
            layerStep
        );
      }
    }

    restingHeights.set(card.id, restingHeight);
  });

  return restingHeights;
}
