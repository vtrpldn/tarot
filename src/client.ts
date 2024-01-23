export function getShuffledCards({ cards }: { cards: string[] }) {
  return fetch("https://api.random.org/json-rpc/4/invoke", {
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
    cache: "no-store",
  })
    .then((response) => {
      return response.json();
    })
    .then((data) => {
      const randomSequence = data.result.random.data[0];
      const shuffledDeck = randomSequence.map(
        (index: number) => cards[index - 1]
      );

      return shuffledDeck as string[];
    });
}
