import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
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
const sourceSheet =
  process.env.LENORMAND_SOURCE_SHEET ??
  join(tmpdir(), "classic-lenormand-game-of-hope.png");

const sourceUrl =
  "https://upload.wikimedia.org/wikipedia/commons/a/a6/Das_Spiel_der_Hofnung_%28The_Game_of_Hope%29.png";
const rendererFallbackUrl =
  "https://commons.wikimedia.org/w/thumb.php?f=Das_Spiel_der_Hofnung_%28The_Game_of_Hope%29.png&w=3900";
const acceptedSourceSha1s = new Set([
  // Wikimedia Commons original file.
  "fb42993d759f0a7b391fc08e8867e7c450cb8905",
  // Pixel-equivalent 3900 px Commons renderer fallback.
  "67e2a85c52427584c64c5ac5acb1757b74d59395",
]);

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

const cropColumns = [120, 720, 1340, 1955, 2565, 3195];
const cropRows = [70, 870, 1660, 2440, 3220, 4005];
const cropWidth = 570;
const cropHeight = 780;
const canvasWidth = 600;
const canvasHeight = 792;
const paperColor = "#efe2bc";
const variants = [
  { directory: previewDirectory, width: 512, quality: 84 },
  { directory: detailDirectory, width: 600, quality: 88 },
];

const backSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="792" viewBox="0 0 600 792">
  <rect width="600" height="792" fill="#efe2bc"/>
  <rect x="22" y="22" width="556" height="748" rx="12" fill="#6b4b3e"/>
  <rect x="36" y="36" width="528" height="720" rx="8" fill="#d9c394" stroke="#efe2bc" stroke-width="4"/>
  <rect x="58" y="58" width="484" height="676" rx="5" fill="#9e6653" stroke="#6b4b3e" stroke-width="7"/>
  <path d="M78 124 L467 488 M78 226 L467 589 M78 327 L467 691 M133 74 L521 437 M241 74 L521 336 M349 74 L521 235 M521 124 L133 488 M521 226 L133 589 M521 327 L133 691 M467 74 L78 437 M359 74 L78 336 M251 74 L78 235" fill="none" stroke="#d9c394" stroke-width="5" opacity=".8"/>
  <rect x="84" y="79" width="432" height="633" rx="4" fill="none" stroke="#efe2bc" stroke-width="5"/>
  <path d="M300 134 L412 240 L300 347 L188 240 Z M300 445 L412 552 L300 659 L188 552 Z" fill="#d9c394" stroke="#6b4b3e" stroke-width="7"/>
  <path d="M300 165 L379 240 L300 316 L221 240 Z M300 476 L379 552 L300 627 L221 552 Z" fill="#a65c55"/>
  <circle cx="300" cy="396" r="42" fill="#efe2bc" stroke="#6b4b3e" stroke-width="7"/>
  <path d="M300 368 L309 387 L332 389 L314 404 L319 425 L300 413 L281 425 L286 404 L268 389 L291 387 Z" fill="#a65c55"/>
</svg>`;

const exists = async (path) =>
  access(path)
    .then(() => true)
    .catch(() => false);

for (const directory of [sourceDirectory, previewDirectory, detailDirectory]) {
  await mkdir(directory, { recursive: true });
}

if (!(await exists(sourceSheet))) {
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
    "5",
    "-A",
    "tarot-asset-builder/1.0 (public-domain archival download)",
  ];

  try {
    await execFileAsync("curl", [
      ...curlArguments,
      sourceUrl,
      "-o",
      sourceSheet,
    ]);
  } catch {
    await execFileAsync("curl", [
      ...curlArguments,
      rendererFallbackUrl,
      "-o",
      sourceSheet,
    ]);
  }
}

const sourceDimensions = (
  await execFileAsync("identify", ["-format", "%wx%h", sourceSheet])
).stdout.trim();
const sourceSha1 = createHash("sha1")
  .update(await readFile(sourceSheet))
  .digest("hex");

if (
  sourceDimensions !== "3900x4900" ||
  !acceptedSourceSha1s.has(sourceSha1)
) {
  throw new Error(
    `Unexpected Game of Hope source: ${sourceDimensions}, SHA-1 ${sourceSha1}`
  );
}

for (const [index, card] of cards.entries()) {
  const column = index % 6;
  const row = Math.floor(index / 6);
  const sourceFile = join(sourceDirectory, `${card}.jpg`);

  await execFileAsync("magick", [
    sourceSheet,
    "-crop",
    `${cropWidth}x${cropHeight}+${cropColumns[column]}+${cropRows[row]}`,
    "+repage",
    "-fuzz",
    "4%",
    "-trim",
    "+repage",
    "-deskew",
    "15%",
    "-fuzz",
    "4%",
    "-trim",
    "+repage",
    "-resize",
    "556x735>",
    "-background",
    paperColor,
    "-gravity",
    "center",
    "-extent",
    `${canvasWidth}x${canvasHeight}`,
    "-quality",
    "95",
    sourceFile,
  ]);
}

const temporaryBack = join(tmpdir(), "classic-lenormand-back.svg");
await writeFile(temporaryBack, backSvg);
await execFileAsync("magick", [
  temporaryBack,
  "-background",
  paperColor,
  "-gravity",
  "center",
  "-extent",
  `${canvasWidth}x${canvasHeight}`,
  "-quality",
  "95",
  join(sourceDirectory, "back.jpg"),
]);

for (const variant of variants) {
  for (const card of [...cards, "back"]) {
    await execFileAsync("cwebp", [
      "-quiet",
      "-q",
      String(variant.quality),
      "-m",
      "6",
      "-resize",
      String(variant.width),
      "0",
      join(sourceDirectory, `${card}.jpg`),
      "-o",
      join(variant.directory, `${card}.webp`),
    ]);
  }
}

console.log(`Built ${cards.length} Game of Hope fronts and one generated card back.`);
