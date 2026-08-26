import type { TableCard } from "@/types";
import type { SceneTableLayout } from "./table-layout";

type Axis = [number, number];

type RotatedCard = {
  center: [number, number];
  axes: [Axis, Axis];
};

type CardFootprint = {
  halfHeight: number;
  halfWidth: number;
};

const OVERLAP_EPSILON = 0.001;

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
  footprint: CardFootprint
): number {
  return (
    footprint.halfWidth * Math.abs(dot(card.axes[0], axis)) +
    footprint.halfHeight * Math.abs(dot(card.axes[1], axis))
  );
}

function cardsOverlap(
  first: RotatedCard,
  second: RotatedCard,
  footprint: CardFootprint
): boolean {
  const centerDelta: Axis = [
    second.center[0] - first.center[0],
    second.center[1] - first.center[1],
  ];

  return [...first.axes, ...second.axes].every((axis) => {
    const centerDistance = Math.abs(dot(centerDelta, axis));
    const combinedRadius =
      projectionRadius(first, axis, footprint) +
      projectionRadius(second, axis, footprint);

    return centerDistance < combinedRadius - OVERLAP_EPSILON;
  });
}

/**
 * Gives intentional XY overlaps a deterministic physical layer. The caller
 * supplies the Rapier footprint rather than the visible card dimensions, so
 * every height corresponds to a collider contact that can actually occur.
 */
export function getTableCardRestingHeights({
  cards,
  footprint,
  layout,
  baseHeight,
  layerStep,
}: {
  cards: TableCard[];
  footprint: CardFootprint;
  layout: SceneTableLayout;
  baseHeight: number;
  layerStep: number;
}): Map<string, number> {
  const restingHeights = new Map<string, number>();
  const orderedCards = [...cards].sort(
    (first, second) => first.zIndex - second.zIndex || first.id.localeCompare(second.id)
  );
  const footprints = orderedCards.map((card) =>
    createRotatedCard(card, layout)
  );

  orderedCards.forEach((card, index) => {
    let restingHeight = baseHeight;

    for (let lowerIndex = 0; lowerIndex < index; lowerIndex += 1) {
      if (cardsOverlap(footprints[index], footprints[lowerIndex], footprint)) {
        restingHeight = Math.max(
          restingHeight,
          (restingHeights.get(orderedCards[lowerIndex].id) ?? baseHeight) +
            layerStep
        );
      }
    }

    restingHeights.set(card.id, restingHeight);
  });

  return restingHeights;
}
