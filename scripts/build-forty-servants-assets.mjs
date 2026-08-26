import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const deckDirectory = join(projectRoot, "public", "decks", "forty-servants");
const sourceDirectory = join(deckDirectory, "source");
const previewDirectory = join(deckDirectory, "preview");
const detailDirectory = join(deckDirectory, "detail");
const downloadUrl =
  "https://www.adventuresinwoowoo.com/wp-content/uploads/2017/08/Low-Res-Deck.zip";
const expectedArchiveSha256 =
  "f74d0ecef95080b76c454cda92ed317b907b97a5cc0a1a6dfe04f3f309daa348";
const temporaryDirectory = await mkdtemp(join(tmpdir(), "forty-servants-"));
const suppliedArchive = process.argv[2];
const archiveFile = suppliedArchive
  ? isAbsolute(suppliedArchive)
    ? suppliedArchive
    : resolve(projectRoot, suppliedArchive)
  : join(temporaryDirectory, "Low-Res-Deck.zip");

const cards = [
  ["the-adventurer", "The Adventurer copy.png"],
  ["the-balancer", "The Balancer copy.png"],
  ["the-carnal", "The Carnal copy.png"],
  ["the-chaste", "The Chaste copy.png"],
  ["the-conductor", "The Conductor copy.png"],
  ["the-contemplator", "The Contemplator copy.png"],
  ["the-dancer", "The Dancer copy.png"],
  ["the-dead", "The Dead copy.png"],
  ["the-depleted", "The Depleted copy.png"],
  ["the-desperate", "The Desperate copy.png"],
  ["the-devil", "The Devil copy.png"],
  ["the-explorer", "The Explorer copy.png"],
  ["the-eye", "The Eye copy.png"],
  ["the-father", "The Father copy.png"],
  ["the-fixer", "The Fixer copy.png"],
  ["the-fortunate", "The Fortunate copy.png"],
  ["the-gate-keeper", "The Gate Keeper copy.png"],
  ["the-giver", "The Giver copy.png"],
  ["the-guru", "The Guru copy.png"],
  ["the-healer", "The Healer copy.png"],
  ["the-idea", "The Idea copy.png"],
  ["the-levitator", "The Levitator copy.png"],
  ["the-librarian", "The Librarian copy.png"],
  ["the-lovers", "The Lover copy.png"],
  ["the-master", "The Master copy.png"],
  ["the-media", "The Media copy.png"],
  ["the-messenger", "The Messenger copy.png"],
  ["the-monk", "The Monk copy.png"],
  ["the-moon", "The Moon copy.png"],
  ["the-mother", "The Mother copy.png"],
  ["the-opposer", "The Opposer copy.png"],
  ["the-planet", "The Planet copy.png"],
  ["the-protector", "The Protector copy.png"],
  ["the-protester", "The Protester copy.png"],
  ["the-road-opener", "The Road Opener copy.png"],
  ["the-saint", "The Saint copy.png"],
  ["the-seer", "The Seer copy.png"],
  ["the-sun", "The Sun copy.png"],
  ["the-thinker", "The Thinker copy.png"],
  ["the-witch", "The Witch copy.png"],
];

if (cards.length !== 40 || new Set(cards.map(([id]) => id)).size !== 40) {
  throw new Error("The Forty Servants mapping must contain 40 unique cards.");
}

for (const directory of [sourceDirectory, previewDirectory, detailDirectory]) {
  await mkdir(directory, { recursive: true });
}

if (!suppliedArchive) {
  await execFileAsync("curl", [
    "--http1.1",
    "-L",
    "--fail",
    "--silent",
    "--show-error",
    "--retry",
    "3",
    "--retry-all-errors",
    "--retry-delay",
    "2",
    "-A",
    "tarot-asset-builder/2.0 (non-commercial official free-resource download)",
    downloadUrl,
    "-o",
    archiveFile,
  ]);
}

const archiveSha256 = createHash("sha256")
  .update(await readFile(archiveFile))
  .digest("hex");

if (archiveSha256 !== expectedArchiveSha256) {
  throw new Error(
    `Official archive SHA-256 changed: ${archiveSha256}, expected ${expectedArchiveSha256}. Review the new source before rebuilding.`
  );
}

await execFileAsync("unzip", ["-q", archiveFile, "-d", temporaryDirectory]);
const extractedDirectory = join(temporaryDirectory, "Low Res Deck");
const extractedPngs = (await readdir(extractedDirectory)).filter((filename) =>
  filename.toLowerCase().endsWith(".png")
);

if (extractedPngs.length !== cards.length) {
  throw new Error(
    `Unexpected official archive: found ${extractedPngs.length} PNG files, expected ${cards.length}.`
  );
}

for (const [id, archiveFilename] of cards) {
  if (!extractedPngs.includes(archiveFilename)) {
    throw new Error(`Official archive is missing ${archiveFilename}.`);
  }

  const sourceFile = join(extractedDirectory, archiveFilename);
  const normalizedSourceFile = join(sourceDirectory, `${id}.png`);
  const { stdout } = await execFileAsync("identify", [
    "-format",
    "%m %w %h",
    sourceFile,
  ]);

  if (stdout.trim() !== "PNG 216 395") {
    throw new Error(
      `Unexpected source for ${id}: ${stdout.trim()}, expected PNG 216 395.`
    );
  }

  await copyFile(sourceFile, normalizedSourceFile);

  await execFileAsync("magick", [
    normalizedSourceFile,
    "-auto-orient",
    "-resize",
    "144x263!",
    "-strip",
    "-define",
    "webp:method=6",
    "-quality",
    "82",
    join(previewDirectory, `${id}.webp`),
  ]);
  await execFileAsync("magick", [
    normalizedSourceFile,
    "-auto-orient",
    "-strip",
    "-define",
    "webp:method=6",
    "-quality",
    "88",
    join(detailDirectory, `${id}.webp`),
  ]);
}

const backSource = join(sourceDirectory, "back.svg");
for (const [directory, dimensions, quality] of [
  [previewDirectory, "144x263!", "82"],
  [detailDirectory, "216x395!", "88"],
]) {
  await execFileAsync("magick", [
    "-background",
    "none",
    backSource,
    "-resize",
    dimensions,
    "-strip",
    "-define",
    "webp:method=6",
    "-quality",
    quality,
    join(directory, "back.webp"),
  ]);
}

console.log(
  "Built 40 official low-resolution Forty Servants fronts and the app-original card back."
);
