import { spawnSync } from "node:child_process";
import path from "node:path";

const npmCliPath =
  process.env.npm_execpath ??
  path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");

const args = process.argv.slice(2);
const planOnly = args.includes("--plan");
const suppliedFiles = args
  .filter((arg) => arg.startsWith("--files="))
  .flatMap((arg) => arg.slice("--files=".length).split(","));

function gitLines(gitArgs) {
  const result = spawnSync("git", gitArgs, {
    encoding: "utf8",
    shell: false
  });

  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || "unknown Git error").trim();
    throw new Error(`git ${gitArgs.join(" ")} failed: ${detail}`);
  }

  return result.stdout
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
}

function changedFiles() {
  if (suppliedFiles.length > 0) {
    return suppliedFiles;
  }

  return [
    ...gitLines(["diff", "--name-only", "--diff-filter=ACMRD", "HEAD"]),
    ...gitLines(["ls-files", "--others", "--exclude-standard"])
  ];
}

function normalize(file) {
  return file.replaceAll("\\", "/").replace(/^\.\//u, "");
}

const files = [...new Set(changedFiles().map(normalize))].sort();
const isDocsOnly = files.every(
  (file) =>
    file.endsWith(".md") ||
    file.startsWith("docs/") ||
    file === "LICENSE" ||
    file === ".gitignore"
);

const requiresFullCheck = files.some(
  (file) =>
    file === "package.json" ||
    file === "package-lock.json" ||
    file.startsWith("scripts/") ||
    file.startsWith("public/data/") ||
    file.startsWith("tsconfig") ||
    file.startsWith("vite.config.")
);

const touchesFrontend = files.some(
  (file) =>
    file.startsWith("src/") ||
    (file.startsWith("public/") && !file.startsWith("public/data/")) ||
    file === "index.html"
);
const touchesPublicMap = files.some(
  (file) =>
    file.startsWith("src/") ||
    file.startsWith("public/") ||
    file === "index.html"
);

function selectChecks() {
  if (files.length === 0 || isDocsOnly) {
    return [];
  }

  if (requiresFullCheck) {
    return ["check"];
  }

  const checks = [];

  if (touchesPublicMap) {
    checks.push("test:ui", "check:public-map-workflow", "check:public-safety-copy");
  }

  if (touchesFrontend || files.some((file) => file.startsWith("server/"))) {
    checks.push("build");
  }

  return checks.length > 0 ? [...new Set(checks)] : ["check"];
}

const checks = selectChecks();

console.log(`Changed-check plan: ${files.length} file(s).`);

if (files.length === 0) {
  console.log("No changes detected; no checks needed.");
  process.exit(0);
}

if (checks.length === 0) {
  console.log("Documentation-only changes detected; no automated checks needed.");
  process.exit(0);
}

console.log(`Checks: ${checks.map((check) => `npm run ${check}`).join(", ")}`);

if (planOnly) {
  process.exit(0);
}

function tail(text, lineCount = 160) {
  return text.split(/\r?\n/u).slice(-lineCount).join("\n").trim();
}

for (const check of checks) {
  const result = spawnSync(process.execPath, [npmCliPath, "run", check], {
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024,
    shell: false
  });

  if (result.error || result.status !== 0) {
    const output = [result.stdout, result.stderr]
      .filter(Boolean)
      .join("\n");

    console.error(`npm run ${check} failed.`);
    console.error(tail(output) || result.error?.message || "No failure output was captured.");
    process.exit(result.status ?? 1);
  }

  console.log(`Passed: npm run ${check}`);
}

console.log("All change-aware checks passed.");
