import { execFile } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const deckDirectory = join(projectRoot, "public", "decks", "tarot-de-marseille");
const sourceDirectory = join(deckDirectory, "source");
const previewDirectory = join(deckDirectory, "preview");
const detailDirectory = join(deckDirectory, "detail");
const downloadDirectory = join(tmpdir(), "tarot-de-marseille-jean-dodal");
const iiifRoot =
  "https://gallica.bnf.fr/iiif/ark:/12148/btv1b10537343h";
const gallicaViewer = "https://gallica.bnf.fr/ark:/12148/btv1b10537343h";

const majorArcana = [
  ["00-le-mat", "f151"],
  ["01-le-bateleur", "f113"],
  ["02-la-papesse", "f115"],
  ["03-l-imperatrice", "f117"],
  ["04-l-empereur", "f119"],
  ["05-le-pape", "f121"],
  ["06-l-amoureux", "f123"],
  ["07-le-chariot", "f125"],
  ["08-la-justice", "f127"],
  ["09-l-ermite", "f129"],
  ["10-la-roue-de-fortune", "f131"],
  ["11-la-force", "f133"],
  ["12-le-pendu", "f135"],
  ["13-arcane-xiii", "f137"],
  ["14-temperance", "f139"],
  ["15-le-diable", "f141"],
  ["16-la-maison-dieu", "f143"],
  ["17-l-etoile", "f145"],
  ["18-la-lune", "f147"],
  ["19-le-soleil", "f149"],
  ["20-le-jugement", "f153"],
  ["21-le-monde", "f155"],
];

const suitCanvases = {
  cups: {
    1: "f93", 2: "f95", 3: "f97", 4: "f99", 5: "f101",
    6: "f103", 7: "f105", 8: "f107", 9: "f109", 10: "f111",
    page: "f89", knight: "f91", queen: "f87", king: "f85",
  },
  pentacles: {
    1: "f1", 2: "f3", 3: "f5", 4: "f7", 5: "f9",
    6: "f11", 7: "f13", 8: "f15", 9: "f17", 10: "f19",
    page: "f25", knight: "f27", queen: "f23", king: "f21",
  },
  swords: {
    1: "f37", 2: "f39", 3: "f41", 4: "f43", 5: "f45",
    6: "f47", 7: "f49", 8: "f51", 9: "f53", 10: "f55",
    page: "f35", knight: "f33", queen: "f31", king: "f29",
  },
  wands: {
    1: "f65", 2: "f67", 3: "f69", 4: "f71", 5: "f73",
    6: "f75", 7: "f77", 8: "f79", 9: "f81", 10: "f83",
    page: "f61", knight: "f63", queen: "f59", king: "f57",
  },
};
const ranks = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "page", "knight", "queen", "king"];
const cards = [
  ...majorArcana.map(([filename, canvas]) => ({ filename, canvas })),
  ...Object.entries(suitCanvases).flatMap(([suit, canvases]) =>
    ranks.map((rank) => ({
      filename: `${suit}-${rank}`,
      canvas: canvases[rank],
    }))
  ),
];
const expected = [...cards, { filename: "back", canvas: "f2" }];
const variants = [
  { directory: sourceDirectory, width: 990, height: 1830, quality: 90 },
  { directory: detailDirectory, width: 792, height: 1464, quality: 86 },
  { directory: previewDirectory, width: 495, height: 915, quality: 80 },
];

async function inBatches(items, batchSize, work) {
  for (let index = 0; index < items.length; index += batchSize) {
    await Promise.all(items.slice(index, index + batchSize).map(work));
  }
}

if (cards.length !== 78 || new Set(cards.map(({ canvas }) => canvas)).size !== 78) {
  throw new Error("The Jean Dodal mapping must contain 78 unique card fronts.");
}

if (cards.some(({ canvas }) => Number(canvas.slice(1)) % 2 !== 1)) {
  throw new Error("Jean Dodal card fronts must map to odd-numbered BnF canvases.");
}

for (const directory of [
  deckDirectory,
  sourceDirectory,
  previewDirectory,
  detailDirectory,
  downloadDirectory,
]) {
  await mkdir(directory, { recursive: true });
}

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
  "Mozilla/5.0 (compatible; tarot-asset-builder/2.0; non-commercial)",
  "-e",
  gallicaViewer,
];

await inBatches(expected, 4, async ({ filename, canvas }) => {
  const downloadFile = join(downloadDirectory, `${filename}.jpg`);
  const url = `${iiifRoot}/${canvas}/full/1200,/0/native.jpg`;
  await execFileAsync("curl", [...curlArguments, url, "-o", downloadFile]);

  const { stdout } = await execFileAsync("identify", [
    "-format",
    "%m %w %h",
    downloadFile,
  ]);
  const [format, widthValue, heightValue] = stdout.trim().split(" ");
  const width = Number(widthValue);
  const height = Number(heightValue);

  if (format !== "JPEG" || width < 1100 || height < 2000) {
    throw new Error(
      `Unexpected BnF source for ${filename} (${canvas}): ${format} ${width}x${height}`
    );
  }
});

await inBatches(expected, 3, async ({ filename }) => {
  const downloadFile = join(downloadDirectory, `${filename}.jpg`);

  for (const variant of variants) {
    await execFileAsync("magick", [
      downloadFile,
      "-auto-orient",
      "-resize",
      `${variant.width}x${variant.height}^`,
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
  "Built 78 Jean Dodal Tarot de Marseille fronts and one historic back from the official BnF IIIF scans."
);
