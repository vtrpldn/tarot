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

const {
  cardSets,
  getCardDisplayName,
  getCardSetDisplayDescription,
  getCardSetDisplayLabel,
  getCardSetDisplayShortLabel,
} = loadTypeScriptModule("src/data/card-sets.ts");
const { getCardReading } = loadTypeScriptModule(
  "src/data/card-readings.ts"
);
const failures = [];
const locales = ["en", "pt-BR"];
const englishAstrologyNames =
  /^(Air|Aquarius|Aries|Cancer|Capricorn|Earth|Fire|Gemini|Jupiter|Leo|Mars|Mercury|Moon|Pisces|Sagittarius|Saturn|Scorpio|Sun|Taurus|Venus|Virgo|Water)\b/;

for (const cardSet of cardSets) {
  for (const locale of locales) {
    if (!getCardSetDisplayLabel(cardSet, locale).trim()) {
      failures.push(`${cardSet.id}:${locale} has no display label`);
    }

    if (!getCardSetDisplayShortLabel(cardSet, locale).trim()) {
      failures.push(`${cardSet.id}:${locale} has no short display label`);
    }

    if (!getCardSetDisplayDescription(cardSet, locale).trim()) {
      failures.push(`${cardSet.id}:${locale} has no display description`);
    }

    if (
      locale === "pt-BR" &&
      (!cardSet.displayLabels?.[locale] ||
        !cardSet.displayShortLabels?.[locale] ||
        !cardSet.displayDescriptions?.[locale])
    ) {
      failures.push(`${cardSet.id}:${locale} is missing direct localized deck metadata`);
    }

    for (const card of cardSet.cards) {
      const cardKey = `${cardSet.id}:${card.id}:${locale}`;
      const name = getCardDisplayName(card, locale);
      const reading = getCardReading(cardSet.id, card, locale);

      if (!name?.trim()) {
        failures.push(`${cardKey} has no display name`);
      }

      if (locale === "pt-BR" && !card.displayNames?.[locale]) {
        failures.push(`${cardKey} is missing a direct localized card name`);
      }

      if (!reading?.summary.trim()) {
        failures.push(`${cardKey} has no summary`);
      }

      if (!reading || reading.correspondences.length < 2) {
        failures.push(`${cardKey} has too few correspondences`);
      }

      if (
        !reading ||
        reading.sources.length === 0 ||
        reading.sources.some(
          (source) =>
            !source.label.trim() ||
            !source.locator?.trim() ||
            !source.href.startsWith("https://")
        )
      ) {
        failures.push(`${cardKey} has invalid sources`);
      }

      if (cardSet.id === "rider-waite-smith") {
        const astrology = reading?.correspondences.find(
          ({ label }) => label === "Astrologia"
        )?.value;

        if (locale === "pt-BR" && astrology && englishAstrologyNames.test(astrology)) {
          failures.push(`${cardKey} has untranslated astrology metadata`);
        }
      }
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
    `Validated ${cardCount} card readings and display names in ${locales.length} locales across ${cardSets.length} decks.`
  );
}
