import { spawn } from "node:child_process";
import path from "node:path";

import {
  checkFocusedE2eRegistry,
  focusedE2eRegistry,
  getFocusedE2eEntryById,
  getFocusedE2eEntryByPath,
  getFocusedE2eRepoRoot,
  normalizeRepoPath
} from "./focused-e2e-registry.mjs";

const repoRoot = getFocusedE2eRepoRoot();

const usage = `Usage:
  node scripts/run-focused-e2e.mjs --list [--json] [--category <category>] [--tag <tag>]
  node scripts/run-focused-e2e.mjs --check [--json]
  node scripts/run-focused-e2e.mjs --id <registryId> [--dry-run]
  node scripts/run-focused-e2e.mjs --path <repoPath> [--dry-run]

This runner executes exactly one selected focused smoke script unless --dry-run is used.
Listing metadata is not execution coverage.`;

const parseArgs = (argv) => {
  const options = {
    mode: null,
    id: null,
    repoPath: null,
    category: null,
    tag: null,
    dryRun: false,
    json: false,
    help: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const nextValue = () => {
      index += 1;
      if (index >= argv.length) {
        throw new Error(`${arg} requires a value.`);
      }
      return argv[index];
    };

    if (arg === "list" || arg === "--list") {
      options.mode = "list";
    } else if (arg === "check" || arg === "--check") {
      options.mode = "check";
    } else if (arg === "run" || arg === "--run") {
      options.mode = "run";
    } else if (arg === "--id") {
      options.id = nextValue();
    } else if (arg.startsWith("--id=")) {
      options.id = arg.slice("--id=".length);
    } else if (arg === "--path") {
      options.repoPath = normalizeRepoPath(nextValue());
    } else if (arg.startsWith("--path=")) {
      options.repoPath = normalizeRepoPath(arg.slice("--path=".length));
    } else if (arg === "--category") {
      options.category = nextValue();
    } else if (arg.startsWith("--category=")) {
      options.category = arg.slice("--category=".length);
    } else if (arg === "--tag") {
      options.tag = nextValue();
    } else if (arg.startsWith("--tag=")) {
      options.tag = arg.slice("--tag=".length);
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--json") {
      options.json = true;
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (options.mode === null) {
    options.mode = options.id !== null || options.repoPath !== null ? "run" : "list";
  }

  return options;
};

const filterEntries = ({ category, tag }) =>
  focusedE2eRegistry.entries.filter((entry) => {
    if (category !== null && entry.category !== category) {
      return false;
    }

    if (tag !== null && !entry.tags.includes(tag)) {
      return false;
    }

    return true;
  });

const printList = (entries) => {
  console.log(`Focused e2e registry (${entries.length} entries)`);
  for (const entry of entries) {
    console.log(
      `- ${entry.id} [${entry.category}] aggregate=${entry.aggregateInclusion.status}`
    );
    console.log(`  command: ${entry.command}`);
    console.log(`  purpose: ${entry.purpose}`);
    console.log(`  coverage: ${entry.executionCoverageClaim}`);
  }
};

const selectEntry = ({ id, repoPath }) => {
  if (id !== null && repoPath !== null) {
    throw new Error("Select by either --id or --path, not both.");
  }

  if (id !== null) {
    return getFocusedE2eEntryById(id);
  }

  if (repoPath !== null) {
    return getFocusedE2eEntryByPath(repoPath);
  }

  throw new Error("Run mode requires --id <registryId> or --path <repoPath>.");
};

const runEntry = async (entry, { dryRun, json }) => {
  if (entry === undefined) {
    throw new Error("Focused e2e selection did not match a registry entry.");
  }

  const runPlan = {
    id: entry.id,
    path: entry.path,
    command: entry.command,
    cwd: "repoRoot",
    dryRun,
    executionCoverageClaim: dryRun ? "dryRunOnlyNoCoverage" : "exactCommandRunsIfExitZero"
  };

  if (dryRun) {
    if (json) {
      console.log(JSON.stringify(runPlan, null, 2));
    } else {
      console.log(`focused-e2e dry run: ${entry.id}`);
      console.log(`cwd: ${repoRoot}`);
      console.log(`command: ${entry.command}`);
      console.log("coverage: dryRunOnlyNoCoverage");
    }
    return;
  }

  if (json) {
    console.log(JSON.stringify(runPlan, null, 2));
  }

  await spawnNodeScript(entry.path);
};

const spawnNodeScript = (repoPath) =>
  new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(repoRoot, repoPath)], {
      cwd: repoRoot,
      stdio: "inherit",
      shell: false
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal !== null) {
        reject(new Error(`Focused e2e process terminated by signal ${signal}.`));
        return;
      }

      if (code !== 0) {
        process.exitCode = code ?? 1;
        resolve();
        return;
      }

      resolve();
    });
  });

const main = async () => {
  let options;

  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error(usage);
    process.exitCode = 1;
    return;
  }

  if (options.help) {
    console.log(usage);
    return;
  }

  try {
    if (options.mode === "list") {
      const entries = filterEntries(options);
      if (options.json) {
        console.log(JSON.stringify({ ...focusedE2eRegistry, entries }, null, 2));
      } else {
        printList(entries);
      }
      return;
    }

    if (options.mode === "check") {
      const report = await checkFocusedE2eRegistry();
      if (options.json) {
        console.log(JSON.stringify(report, null, 2));
      } else if (report.verdict === "pass") {
        console.log(
          `Focused e2e registry check passed: ${report.summary.entryCount} entries.`
        );
      } else {
        console.error("Focused e2e registry violations found:");
        for (const finding of report.findings) {
          console.error(`- ${finding}`);
        }
      }

      if (report.verdict !== "pass") {
        process.exitCode = 1;
      }
      return;
    }

    await runEntry(selectEntry(options), options);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
};

await main();
