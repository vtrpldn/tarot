import { Deck } from "@/components/Deck";
import { minorArcana } from "@/consts";

export default function Minor() {
  return (
    <main className="min-h-screen p-24 grid grid-cols-1">
      <div>
        <div>Minor arcana</div>
        <Deck type="minorArcana" cards={minorArcana} />
      </div>
    </main>
  );
}
