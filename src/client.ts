export function getShuffledCards({
  cards,
  trueRandom = false,
}: {
  cards: string[];
  trueRandom?: boolean;
}): Promise<string[]> {
  if (trueRandom) {
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

  // Fisher-Yates shuffle algorithm for non-true random case
  return Promise.resolve().then(() => {
    const shuffledCards = [...cards];
    for (let i = shuffledCards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledCards[i], shuffledCards[j]] = [
        shuffledCards[j],
        shuffledCards[i],
      ];
    }
    return shuffledCards;
  });
}
