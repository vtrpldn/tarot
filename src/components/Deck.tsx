"use client";

import { TarotDecks } from "@/types";
import { Card } from "./Card";
import { DndContext, DragEndEvent } from "@dnd-kit/core";
import { useState } from "react";

export function Deck({ type, cards }: { type: TarotDecks; cards: string[] }) {
  const [activeCardId, setActiveCardId] = useState<string>("");
  const [delta, setDelta] = useState<Record<string, number>>({
    x: 0,
    y: 0,
  });

  function handleDragEnd({ delta, active }: DragEndEvent) {
    setActiveCardId(active.id as string);
    setDelta(delta);
  }

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="relative">
        {cards.map((card) => {
          const cardId = `checkbox-${type}-${card}`;

          return (
            <Card
              key={card}
              card={card}
              cardId={cardId}
              activeCardId={activeCardId}
              delta={delta}
            />
          );
        })}
      </div>
    </DndContext>
  );
}
