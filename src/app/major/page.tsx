import { Deck } from "@/components/Deck";
import { majorArcana } from "@/consts";

export default function Major() {
  return (
    <main className="min-h-screen p-24 grid grid-cols-1">
      <div>
        <div>Major arcana</div>
        <Deck type="majorArcana" cards={majorArcana} />
      </div>
    </main>
  );
}
