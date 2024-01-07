import { Deck } from "@/components/Deck";
import { allCards } from "@/consts";

export default function Home() {
  return (
    <main className="min-h-screen p-24 grid grid-cols-1">
      <div>
        <div>All cards</div>
        <Deck type="all" cards={allCards} />
      </div>
    </main>
  );
}
