import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const MAX_SOURCE_FILE_LINES = 900;
const root = path.resolve(import.meta.dirname, "..");
const sourceRoot = path.join(root, "src");
const excludedDirectories = new Set([
  "dist",
  "node_modules",
  "public",
  "scripts",
  "server"
]);

function formatRelativePath(filePath) {
  return path.relative(root, filePath).split(path.sep).join("/");
}

function countLines(source) {
  const normalized = source.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  if (normalized.length === 0) {
    return 0;
  }

  const content = normalized.endsWith("\n")
    ? normalized.slice(0, -1)
    : normalized;

  return content.split("\n").length;
}

async function collectSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      if (!excludedDirectories.has(entry.name)) {
        files.push(...(await collectSourceFiles(entryPath)));
      }

      continue;
    }

    if (entry.isFile() && /\.(?:ts|tsx)$/.test(entry.name)) {
      files.push(entryPath);
    }
  }

  return files;
}

const sourceFiles = await collectSourceFiles(sourceRoot);
const fileLineCounts = await Promise.all(
  sourceFiles.map(async (filePath) => ({
    file: formatRelativePath(filePath),
    lines: countLines(await readFile(filePath, "utf8"))
  }))
);

fileLineCounts.sort(
  (a, b) => b.lines - a.lines || a.file.localeCompare(b.file)
);

const oversizedFiles = fileLineCounts.filter(
  ({ lines }) => lines > MAX_SOURCE_FILE_LINES
);

if (oversizedFiles.length > 0) {
  console.error(
    `Source file size guard failed: ${oversizedFiles.length} src file(s) exceed ${MAX_SOURCE_FILE_LINES} lines.`
  );

  for (const { file, lines } of oversizedFiles) {
    console.error(`- ${file}: ${lines} lines`);
  }

  process.exit(1);
}

console.log(
  `Source file size guard passed: ${sourceFiles.length} src TypeScript files are at or below ${MAX_SOURCE_FILE_LINES} lines.`
);
console.log("Top 5 largest src files:");

for (const { file, lines } of fileLineCounts.slice(0, 5)) {
  console.log(`- ${file}: ${lines} lines`);
}
