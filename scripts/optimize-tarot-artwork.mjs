import { execFile } from "node:child_process";
import { readdir, mkdir } from "node:fs/promises";
import { promisify } from "node:util";
import { dirname, join, parse } from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const sourceDirectory = join(projectRoot, "public", "img");
const outputDirectory = join(
  projectRoot,
  "public",
  "decks",
  "rider-waite-smith"
);
const variants = [
  { directory: "preview", width: 512, quality: 84 },
  { directory: "detail", width: 768, quality: 88 },
];

const sourceFiles = (await readdir(sourceDirectory))
  .filter((filename) => filename.endsWith(".png"))
  .sort();

for (const variant of variants) {
  const variantDirectory = join(outputDirectory, variant.directory);
  await mkdir(variantDirectory, { recursive: true });

  for (const sourceFile of sourceFiles) {
    const outputFile = join(variantDirectory, `${parse(sourceFile).name}.webp`);

    await execFileAsync("cwebp", [
      "-quiet",
      "-q",
      String(variant.quality),
      "-m",
      "6",
      "-resize",
      String(variant.width),
      "0",
      join(sourceDirectory, sourceFile),
      "-o",
      outputFile,
    ]);
  }
}

console.log(
  `Optimized ${sourceFiles.length} artwork files into ${variants.length} responsive WebP variants.`
);
