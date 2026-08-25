import { execFile } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const deckDirectory = join(projectRoot, "public", "decks", "classic-lenormand");
const sourceDirectory = join(deckDirectory, "source");
const previewDirectory = join(deckDirectory, "preview");
const detailDirectory = join(deckDirectory, "detail");
const galleryPage = join(tmpdir(), "stralsund-lenormand.html");
const galleryUrl =
  "https://etteilla.org/en/deck/7/stralsund-mlle-lenormand-oracle-deck";

const cards = [
  "01-rider",
  "02-clover",
  "03-ship",
  "04-house",
  "05-tree",
  "06-clouds",
  "07-snake",
  "08-coffin",
  "09-bouquet",
  "10-scythe",
  "11-whip",
  "12-birds",
  "13-child",
  "14-fox",
  "15-bear",
  "16-stars",
  "17-stork",
  "18-dog",
  "19-tower",
  "20-garden",
  "21-mountain",
  "22-crossroads",
  "23-mice",
  "24-heart",
  "25-ring",
  "26-book",
  "27-letter",
  "28-man",
  "29-woman",
  "30-lily",
  "31-sun",
  "32-moon",
  "33-key",
  "34-fish",
  "35-anchor",
  "36-cross",
];

const expected = [
  ...cards.map((filename, index) => ({
    filename,
    label: `Oracles - ${index + 1}`,
  })),
  { filename: "back", label: "Card backs - No value" },
];

const variants = [
  { directory: previewDirectory, width: 510, height: 830, quality: 82 },
  { directory: detailDirectory, width: 918, height: 1494, quality: 88 },
];

const curlArguments = [
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
  "tarot-asset-builder/2.0 (non-commercial archival download)",
];

const decodeAttribute = (value) => value.replaceAll("&amp;", "&");

async function download(url, destination) {
  await execFileAsync("curl", [...curlArguments, url, "-o", destination]);
}

async function inBatches(items, batchSize, work) {
  for (let index = 0; index < items.length; index += batchSize) {
    await Promise.all(items.slice(index, index + batchSize).map(work));
  }
}

for (const directory of [sourceDirectory, previewDirectory, detailDirectory]) {
  await mkdir(directory, { recursive: true });
}

await download(galleryUrl, galleryPage);
const galleryHtml = await readFile(galleryPage, "utf8");
const galleryItems = new Map();
const anchorPattern =
  /<a\b[^>]*\bdata-src="([^"]+)"[^>]*>[\s\S]*?<img\b[^>]*\balt="([^"]+)"/g;

for (const match of galleryHtml.matchAll(anchorPattern)) {
  const [, url, label] = match;
  if (label.startsWith("Oracles - ") || label === "Card backs - No value") {
    galleryItems.set(label, decodeAttribute(url));
  }
}

const missingLabels = expected.filter(({ label }) => !galleryItems.has(label));
if (missingLabels.length || galleryItems.size !== expected.length) {
  throw new Error(
    `Unexpected Etteilla gallery: found ${galleryItems.size} of ${expected.length} assets; missing ${missingLabels
      .map(({ label }) => label)
      .join(", ")}`
  );
}

await inBatches(expected, 4, async ({ filename, label }) => {
  const sourceFile = join(sourceDirectory, `${filename}.avif`);
  await download(galleryItems.get(label), sourceFile);

  const { stdout } = await execFileAsync("identify", [
    "-format",
    "%m %w %h",
    sourceFile,
  ]);
  const [format, widthValue, heightValue] = stdout.trim().split(" ");
  const width = Number(widthValue);
  const height = Number(heightValue);
  const aspectRatio = width / height;

  if (
    format !== "AVIF" ||
    width < 1200 ||
    height < 2000 ||
    aspectRatio < 0.58 ||
    aspectRatio > 0.64
  ) {
    throw new Error(
      `Unexpected ${label} source: ${format} ${width}x${height}`
    );
  }
});

await inBatches(expected, 3, async ({ filename }) => {
  const sourceFile = join(sourceDirectory, `${filename}.avif`);

  for (const variant of variants) {
    await execFileAsync("magick", [
      sourceFile,
      "-auto-orient",
      "-resize",
      `${variant.width}x${variant.height}`,
      "-background",
      "none",
      "-gravity",
      "center",
      "-extent",
      `${variant.width}x${variant.height}`,
      "-strip",
      "-define",
      "webp:method=6",
      "-quality",
      String(variant.quality),
      join(variant.directory, `${filename}.webp`),
    ]);
  }
});

console.log(
  `Built ${cards.length} Stralsund Lenormand fronts and the historic card back from native archival scans.`
);
