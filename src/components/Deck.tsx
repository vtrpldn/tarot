"use client";

import { TarotDecks } from "@/types";
import { Card } from "./Card";
import { DndContext, DragEndEvent } from "@dnd-kit/core";
import { useState } from "react";

export function Deck({ type, cards }: { type: TarotDecks; cards: string[] }) {
  const [activeCardId, setActiveCardId] = useState<string>("");
  const [dragDelta, setDragDelta] = useState<Record<string, number>>({
    x: 0,
    y: 0,
  });

  function handleDragEnd({ delta, active }: DragEndEvent) {
    setActiveCardId(active.id as string);
    setDragDelta(delta);
  }

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="relative">
        {cards.map((card, index) => {
          const cardId = `checkbox-${type}-${card}`;

          return (
            <Card
              key={card}
              card={card}
              cardId={cardId}
              activeCardId={activeCardId}
              dragDelta={dragDelta}
              isTopCard={index === cards.length - 1}
            />
          );
        })}
      </div>
    </DndContext>
  );
}
