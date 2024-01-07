import { allCards, majorArcana, minorArcana } from "@/consts";
import Image from "next/image";

export default function Home() {
  return (
    <main className="min-h-screen p-24 grid grid-cols-3">
      <div>
        <div>Major arcana</div>
        <Deck cards={majorArcana} />
      </div>
      <div>
        <div>Minor arcana</div>
        <Deck cards={minorArcana} />
      </div>
      <div>
        <div>All cards</div>
        <Deck cards={allCards} />
      </div>
    </main>
  );
}

async function Deck({ cards }: { cards: string[] }) {
  const shuffledCards = await getShuffledCards({ cards, pseudoRandom: true });

  return shuffledCards.map((card) => (
    <div key={card} className="flex flex-col items-center justify-center">
      <Image
        src={`/img/${card}`}
        alt={card}
        width={400}
        height={600}
        className="rounded-lg"
      />
    </div>
  ));
}

function getShuffledCards({
  cards,
  pseudoRandom = false,
}: {
  cards: string[];
  pseudoRandom?: boolean;
}) {
  if (pseudoRandom) {
    return cards.sort(() => Math.random() - 0.5);
  }

  return (
    fetch("https://api.random.org/json-rpc/4/invoke", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apiKey: process.env.RANDOM_ORG_API_KEY ?? "",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "generateIntegerSequences",
        params: {
          apiKey: process.env.RANDOM_ORG_API_KEY ?? "",
          n: 1,
          length: cards.length,
          min: 1,
          max: cards.length,
          replacement: false,
        },
        id: 1,
      }),
    })
      .then((response) => response.json())
      .then((data) => {
        const randomSequence = data.result.random.data[0];
        const shuffledDeck = randomSequence.map(
          (index: number) => cards[index - 1]
        );

        return shuffledDeck as string[];
      }) ?? []
  );
}
