import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

const competitions = Object.freeze([
  {
    name: "Global Innovation Build Challenge V2",
    reconstructed: true,
    start: "2026-07-11T12:00:00+08:00",
    tag: "competition/gibc-v2-2026-baseline"
  },
  {
    name: "Hack for Humanity Summer 2026",
    reconstructed: true,
    start: "2026-08-07T12:00:00-04:00",
    tag: "competition/hack-for-humanity-summer-2026-baseline"
  },
  {
    name: "UnivaBio",
    reconstructed: true,
    start: "2026-08-07T00:00:00-04:00",
    tag: "competition/univabio-2026-baseline"
  },
  {
    name: "NextStep Hacks 2026",
    reconstructed: true,
    start: "2026-08-21T00:00:00-04:00",
    tag: "competition/nextstep-hacks-2026-baseline"
  },
  {
    name: "FirstCommit",
    reconstructed: true,
    start: "2026-08-21T00:00:00-04:00",
    tag: "competition/firstcommit-2026-baseline"
  },
  {
    name: "GatewayHacks 2026",
    start: "2026-09-01T00:00:00-04:00",
    tag: "competition/gatewayhacks-2026-baseline"
  },
  {
    name: "CSC Back-to-School Hackathon",
    start: "2026-09-04T00:00:00-07:00",
    tag: "competition/csc-back-to-school-2026-baseline"
  },
  {
    name: "Lake Oswego Hacks",
    start: "2026-09-26T09:00:00-07:00",
    tag: "competition/lake-oswego-hacks-2026-baseline"
  },
  {
    name: "ForgeHacks Online 2026",
    start: "2026-10-03T12:00:00-04:00",
    tag: "competition/forgehacks-online-2026-baseline"
  },
  {
    name: "Bridge the Gap Hacks",
    start: "2026-11-15T00:00:00-08:00",
    tag: "competition/bridge-the-gap-hacks-2026-baseline"
  }
]);

const apply = process.argv.includes("--apply");
const ledgerArgument = process.argv.find((argument) =>
  argument.startsWith("--ledger=")
);
const ledgerPath = ledgerArgument
  ? path.resolve(projectRoot, ledgerArgument.slice("--ledger=".length))
  : path.join(projectRoot, "docs", "competition-baselines.md");
const nowArgument = process.argv.find((argument) =>
  argument.startsWith("--now=")
);

function git(args, options = {}) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: options.quiet ? ["ignore", "pipe", "ignore"] : ["ignore", "pipe", "pipe"]
  }).trim();
}

function refExists(ref) {
  try {
    git(["rev-parse", "--verify", "--quiet", ref], { quiet: true });
    return true;
  } catch {
    return false;
  }
}

const sourceRef = refExists("refs/remotes/origin/main")
  ? "refs/remotes/origin/main"
  : refExists("refs/heads/main")
    ? "refs/heads/main"
    : "HEAD";
const now = nowArgument
  ? Date.parse(nowArgument.slice("--now=".length))
  : Date.now();
if (Number.isNaN(now)) {
  throw new Error("The --now value must be an ISO-compatible timestamp.");
}
let created = 0;
const ledgerEntries = [];

for (const competition of competitions) {
  const startTime = Date.parse(competition.start);
  if (Number.isNaN(startTime)) {
    throw new Error(`Invalid start timestamp for ${competition.name}.`);
  }
  if (now < startTime) {
    console.log(`PENDING ${competition.tag} (${competition.start})`);
    continue;
  }

  const baselineCommit = git([
    "rev-list",
    "-1",
    `--before=${competition.start}`,
    sourceRef
  ]);
  if (!baselineCommit) {
    throw new Error(`No commit exists before ${competition.name} began.`);
  }

  if (refExists(`refs/tags/${competition.tag}`)) {
    const taggedCommit = git(["rev-list", "-1", competition.tag]);
    if (taggedCommit !== baselineCommit) {
      throw new Error(
        `${competition.tag} points to ${taggedCommit}, but ${baselineCommit} is the latest commit before the official start.`
      );
    }
    console.log(`VERIFIED ${competition.tag} -> ${baselineCommit.slice(0, 12)}`);
  } else if (!apply) {
    console.log(`WOULD_CREATE ${competition.tag} -> ${baselineCommit.slice(0, 12)}`);
  } else {
    const recordedAt = new Date().toISOString();
    git([
      "tag",
      "-a",
      competition.tag,
      baselineCommit,
      "-m",
      [
        `CareAtlas baseline for ${competition.name}.`,
        `Official event start: ${competition.start}.`,
        `Recorded: ${recordedAt}.`,
        `This tag identifies the latest origin/main commit before the official start. It does not by itself establish submission eligibility.`
      ].join("\n")
    ]);
    created += 1;
    console.log(`CREATED ${competition.tag} -> ${baselineCommit.slice(0, 12)}`);
  }

  ledgerEntries.push({ baselineCommit, competition });
}

const ledgerSource = readFileSync(ledgerPath, "utf8");
const newline = ledgerSource.includes("\r\n") ? "\r\n" : "\n";
const ledgerLines = ledgerSource.split(/\r?\n/u);
let updatedRows = 0;

for (const { baselineCommit, competition } of ledgerEntries) {
  const tagCell = `\`${competition.tag}\``;
  const rowIndex = ledgerLines.findIndex(
    (line) => line.startsWith(`| ${competition.name} |`) && line.includes(tagCell)
  );
  if (rowIndex < 0) {
    throw new Error(`The baseline ledger has no row for ${competition.name}.`);
  }

  const status = `${competition.reconstructed ? "Reconstructed" : "Tagged automatically"}: \`${baselineCommit.slice(0, 12)}\``;
  const updatedLine = ledgerLines[rowIndex].replace(
    /\| [^|]*\|\s*$/u,
    `| ${status} |`
  );
  if (updatedLine === ledgerLines[rowIndex]) continue;

  updatedRows += 1;
  ledgerLines[rowIndex] = updatedLine;
  console.log(
    `${apply ? "UPDATED" : "WOULD_UPDATE"} ledger row for ${competition.name} -> ${status}`
  );
}

if (apply && updatedRows > 0) {
  writeFileSync(ledgerPath, ledgerLines.join(newline), "utf8");
}

console.log(
  `${apply ? "Applied" : "Checked"} competition baselines; ${created} tag(s) created, ${updatedRows} ledger row(s) ${apply ? "updated" : "need updates"}.`
);
