import { getShuffledCards } from "@/client";
import { Deck } from "@/components/Deck";
import { allCards } from "@/consts";

export default async function Home() {
  const shuffledCards = await getShuffledCards({ cards: allCards });

  return (
    <main className="min-h-screen p-24 grid grid-cols-1">
      <Deck type="all" cards={shuffledCards} />
    </main>
  );
}
