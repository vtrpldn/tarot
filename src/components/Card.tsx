import { TarotDecks } from "@/types";
import Image from "next/image";

export function Card({ type, card }: { type: TarotDecks; card: string }) {
  const checkboxId = `checkbox-${type}-${card}`;

  return (
    <div
      key={card}
      className="card flex flex-col items-center justify-center relative"
    >
      <input type="checkbox" id={checkboxId} className="hidden" />
      <label
        htmlFor={checkboxId}
        className="relative cursor-pointer overflow-hidden rounded-2xl"
      >
        <div className="back absolute top-0 left-0 w-full h-full bg-black" />
        <Image src={`/img/${card}`} alt={card} width={400} height={688} />
      </label>
    </div>
  );
}
