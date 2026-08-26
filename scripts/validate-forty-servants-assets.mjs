import { execFile } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const deckDirectory = join(projectRoot, "public", "decks", "forty-servants");
const cards = [
  "the-adventurer", "the-balancer", "the-carnal", "the-chaste",
  "the-conductor", "the-contemplator", "the-dancer", "the-dead",
  "the-depleted", "the-desperate", "the-devil", "the-explorer", "the-eye",
  "the-father", "the-fixer", "the-fortunate", "the-gate-keeper", "the-giver",
  "the-guru", "the-healer", "the-idea", "the-levitator", "the-librarian",
  "the-lovers", "the-master", "the-media", "the-messenger", "the-monk",
  "the-moon", "the-mother", "the-opposer", "the-planet", "the-protector",
  "the-protester", "the-road-opener", "the-saint", "the-seer", "the-sun",
  "the-thinker", "the-witch",
];
const failures = [];

async function metadata(path) {
  const { stdout } = await execFileAsync("identify", [
    "-format",
    "%m %w %h",
    path,
  ]);
  const [format, width, height] = stdout.trim().split(" ");
  return { format, width: Number(width), height: Number(height) };
}

for (const card of cards) {
  const variants = [
    { path: join(deckDirectory, "source", `${card}.png`), format: "PNG", width: 216, height: 395 },
    { path: join(deckDirectory, "preview", `${card}.webp`), format: "WEBP", width: 144, height: 263 },
    { path: join(deckDirectory, "detail", `${card}.webp`), format: "WEBP", width: 216, height: 395 },
  ];

  for (const expected of variants) {
    try {
      await access(expected.path);
      const result = await metadata(expected.path);
      if (
        result.format !== expected.format ||
        result.width !== expected.width ||
        result.height !== expected.height
      ) {
        failures.push(
          `${card}: ${result.format} ${result.width}x${result.height}, expected ${expected.format} ${expected.width}x${expected.height}`
        );
      }
    } catch {
      failures.push(`${card}: missing or unreadable asset ${expected.path}`);
    }
  }
}

try {
  const backSource = await readFile(
    join(deckDirectory, "source", "back.svg"),
    "utf8"
  );
  if (!backSource.includes("viewBox=\"0 0 216 395\"")) {
    failures.push("back.svg: expected a 216x395 viewBox");
  }
} catch {
  failures.push("back.svg: missing or unreadable");
}

for (const expected of [
  { directory: "preview", width: 144, height: 263 },
  { directory: "detail", width: 216, height: 395 },
]) {
  const path = join(deckDirectory, expected.directory, "back.webp");
  try {
    const result = await metadata(path);
    if (
      result.format !== "WEBP" ||
      result.width !== expected.width ||
      result.height !== expected.height
    ) {
      failures.push(
        `${expected.directory}/back: ${result.format} ${result.width}x${result.height}, expected WEBP ${expected.width}x${expected.height}`
      );
    }
  } catch {
    failures.push(`${expected.directory}/back: missing or unreadable`);
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(
  `Validated ${cards.length} Forty Servants fronts and the app-original card back.`
);
