import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const deckDirectory = join(projectRoot, "public", "decks", "classic-lenormand");
const expected = [
  "01-rider", "02-clover", "03-ship", "04-house", "05-tree", "06-clouds",
  "07-snake", "08-coffin", "09-bouquet", "10-scythe", "11-whip", "12-birds",
  "13-child", "14-fox", "15-bear", "16-stars", "17-stork", "18-dog",
  "19-tower", "20-garden", "21-mountain", "22-crossroads", "23-mice", "24-heart",
  "25-ring", "26-book", "27-letter", "28-man", "29-woman", "30-lily",
  "31-sun", "32-moon", "33-key", "34-fish", "35-anchor", "36-cross", "back",
];

const dimensions = async (path) => {
  const { stdout } = await execFileAsync("identify", ["-format", "%w %h", path]);
  return stdout.trim().split(" ").map(Number);
};
const expectedDimensions = {
  source: [600, 792],
  preview: [512, 676],
  detail: [600, 792],
};

const failures = [];
const report = [];
const variantDimensions = new Map();

for (const name of expected) {
  const files = [
    { label: "source", path: join(deckDirectory, "source", `${name}.jpg`) },
    { label: "preview", path: join(deckDirectory, "preview", `${name}.webp`) },
    { label: "detail", path: join(deckDirectory, "detail", `${name}.webp`) },
  ];

  for (const file of files) {
    try {
      await access(file.path);
      const [width, height] = await dimensions(file.path);
      const [expectedWidth, expectedHeight] = expectedDimensions[file.label];
      if (width !== expectedWidth || height !== expectedHeight) {
        failures.push(
          `${file.label}/${name}: ${width}x${height}, expected ${expectedWidth}x${expectedHeight}`
        );
      }
      const key = file.label;
      const previous = variantDimensions.get(key);
      if (previous && (previous[0] !== width || previous[1] !== height)) {
        failures.push(
          `${file.label}/${name}: ${width}x${height}, expected ${previous[0]}x${previous[1]}`
        );
      } else if (!previous) {
        variantDimensions.set(key, [width, height]);
      }
      report.push(`${file.label}/${name} ${width}x${height}`);
    } catch {
      failures.push(`${file.label}/${name}: missing or unreadable`);
    }
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Validated ${expected.length} source, preview, and detail assets.`);
console.log(
  `Uniform dimensions: ${[...variantDimensions.entries()]
    .map(([variant, [width, height]]) => `${variant} ${width}x${height}`)
    .join(", ")}.`
);
console.log(report.join("\n"));
