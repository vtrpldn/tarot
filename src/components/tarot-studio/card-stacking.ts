import type { TableCard } from "@/types";
import { getCardStackLevels } from "@/lib/card-balance";
import type { SceneTableLayout } from "./table-layout";

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
  return new Map(
    Array.from(
      getCardStackLevels({ cards, layout, baseHeight, layerStep }).entries()
    ).map(([cardId, level]) => [cardId, level.height])
  );
}
