import { getShuffledCards } from "@/client";
import { Deck } from "@/components/Deck";
import { minorArcana } from "@/consts";

export default async function Minor() {
  const shuffledCards = await getShuffledCards({ cards: minorArcana });

  return (
    <main className="min-h-screen p-24 grid grid-cols-1">
      <Deck type="minorArcana" cards={shuffledCards} />
    </main>
  );
}
