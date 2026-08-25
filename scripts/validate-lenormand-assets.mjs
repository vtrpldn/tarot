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

const metadata = async (path) => {
  const { stdout } = await execFileAsync("identify", [
    "-format",
    "%m %w %h %[opaque]",
    path,
  ]);
  const [format, width, height, opaque] = stdout.trim().split(" ");
  return { format, width: Number(width), height: Number(height), opaque };
};

const failures = [];

for (const name of expected) {
  const files = [
    {
      label: "source",
      path: join(deckDirectory, "source", `${name}.avif`),
      format: "AVIF",
    },
    {
      label: "preview",
      path: join(deckDirectory, "preview", `${name}.webp`),
      format: "WEBP",
      width: 510,
      height: 830,
    },
    {
      label: "detail",
      path: join(deckDirectory, "detail", `${name}.webp`),
      format: "WEBP",
      width: 918,
      height: 1494,
    },
  ];

  for (const file of files) {
    try {
      await access(file.path);
      const result = await metadata(file.path);

      if (result.format !== file.format) {
        failures.push(
          `${file.label}/${name}: ${result.format}, expected ${file.format}`
        );
      }

      if (file.label === "source") {
        if (result.width < 1200 || result.height < 2000) {
          failures.push(
            `${file.label}/${name}: ${result.width}x${result.height}, expected at least 1200x2000`
          );
        }
      } else if (result.width !== file.width || result.height !== file.height) {
        failures.push(
          `${file.label}/${name}: ${result.width}x${result.height}, expected ${file.width}x${file.height}`
        );
      }

      if (result.opaque !== "False") {
        failures.push(`${file.label}/${name}: expected preserved edge transparency`);
      }
    } catch {
      failures.push(`${file.label}/${name}: missing or unreadable`);
    }
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(
  `Validated ${expected.length} native Stralsund sources and optimized transparent preview/detail assets.`
);
