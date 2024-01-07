import { getShuffledCards } from "@/client";
import { TarotDecks } from "@/types";
import { Card } from "./Card";

export async function Deck({
  type,
  cards,
}: {
  type: TarotDecks;
  cards: string[];
}) {
  const shuffledCards = await getShuffledCards({ cards, pseudoRandom: true });

  return (
    <div className="space-y-4">
      {shuffledCards.map((card) => (
        <Card type={type} key={card} card={card} />
      ))}
    </div>
  );
}
