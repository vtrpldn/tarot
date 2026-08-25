import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const deckDirectory = join(projectRoot, "public", "decks", "tarot-de-marseille");
const majorArcana = [
  "00-le-mat", "01-le-bateleur", "02-la-papesse", "03-l-imperatrice",
  "04-l-empereur", "05-le-pape", "06-l-amoureux", "07-le-chariot",
  "08-la-justice", "09-l-ermite", "10-la-roue-de-fortune", "11-la-force",
  "12-le-pendu", "13-arcane-xiii", "14-temperance", "15-le-diable",
  "16-la-maison-dieu", "17-l-etoile", "18-la-lune", "19-le-soleil",
  "20-le-jugement", "21-le-monde",
];
const ranks = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "page", "knight", "queen", "king"];
const expected = [
  ...majorArcana,
  ...["cups", "pentacles", "swords", "wands"].flatMap((suit) =>
    ranks.map((rank) => `${suit}-${rank}`)
  ),
  "back",
];
const variants = [
  { directory: "source", width: 990, height: 1830 },
  { directory: "detail", width: 792, height: 1464 },
  { directory: "preview", width: 495, height: 915 },
];
const failures = [];

for (const filename of expected) {
  for (const variant of variants) {
    const path = join(
      deckDirectory,
      variant.directory,
      `${filename}.webp`
    );

    try {
      await access(path);
      const { stdout } = await execFileAsync("identify", [
        "-format",
        "%m %w %h",
        path,
      ]);
      const [format, widthValue, heightValue] = stdout.trim().split(" ");
      const width = Number(widthValue);
      const height = Number(heightValue);

      if (
        format !== "WEBP" ||
        width !== variant.width ||
        height !== variant.height
      ) {
        failures.push(
          `${variant.directory}/${filename}: ${format} ${width}x${height}, expected WEBP ${variant.width}x${variant.height}`
        );
      }
    } catch {
      failures.push(`${variant.directory}/${filename}: missing or unreadable`);
    }
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(
  `Validated ${expected.length} complete source, detail, and preview Jean Dodal assets.`
);
