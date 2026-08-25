import fs from "node:fs";
import ts from "typescript";

function loadTypeScriptModule(file) {
  const source = fs.readFileSync(file, "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  const loadedModule = { exports: {} };

  Function("exports", "module", "require", code)(
    loadedModule.exports,
    loadedModule,
    () => {
      throw new Error(`Unexpected runtime import while loading ${file}`);
    }
  );

  return loadedModule.exports;
}

const { cardSets } = loadTypeScriptModule("src/data/card-sets.ts");
const { getCardReading } = loadTypeScriptModule(
  "src/data/card-readings.ts"
);
const failures = [];

for (const cardSet of cardSets) {
  for (const card of cardSet.cards) {
    const reading = getCardReading(cardSet.id, card);

    if (!reading?.summary.trim()) {
      failures.push(`${cardSet.id}:${card.id} has no summary`);
    }

    if (!reading || reading.correspondences.length < 2) {
      failures.push(`${cardSet.id}:${card.id} has too few correspondences`);
    }

    if (
      !reading ||
      reading.sources.length === 0 ||
      reading.sources.some((source) => !source.href.startsWith("https://"))
    ) {
      failures.push(`${cardSet.id}:${card.id} has invalid sources`);
    }
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  const cardCount = cardSets.reduce(
    (total, cardSet) => total + cardSet.cards.length,
    0
  );

  console.log(
    `Validated ${cardCount} card readings across ${cardSets.length} decks.`
  );
}
