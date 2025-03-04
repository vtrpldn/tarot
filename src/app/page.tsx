import { getShuffledCards } from "@/client";
import { Deck } from "@/components/Deck";
import { PannableArea } from "@/components/PannableArea";
import { allCards } from "@/consts";

export default async function Home() {
  const shuffledCards = await getShuffledCards({ cards: allCards });

  return (
    <main className="h-screen w-screen overflow-hidden">
      <PannableArea className="border rounded-md p-2 bg-slate-300">
        <Deck type="all" cards={shuffledCards} />
      </PannableArea>
    </main>
  );
}
