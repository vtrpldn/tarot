"use client";

import { TarotDecks } from "@/types";
import { Card } from "./Card";

export function Deck({ type, cards }: { type: TarotDecks; cards: string[] }) {
  return (
    <div className="relative">
      {cards.map((card, index) => {
        if (index >= 3) {
          return null;
        }

        return (
          <Card key={card} card={card} isTopCard={index === cards.length - 1} />
        );
      })}
    </div>
  );
}
