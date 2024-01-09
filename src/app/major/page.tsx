import { getShuffledCards } from "@/client";
import { Deck } from "@/components/Deck";
import { majorArcana } from "@/consts";

export default async function Major() {
  const shuffledCards = await getShuffledCards({ cards: majorArcana });

  return (
    <main className="min-h-screen p-24 grid grid-cols-1">
      <Deck type="majorArcana" cards={shuffledCards} />
    </main>
  );
}
