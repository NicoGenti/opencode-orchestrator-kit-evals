// Evaluation runner.
//
// v1 only supports DRY_RUN: it produces the full artifact contract with every
// metric set to null, derived exclusively from the scenario definitions. No
// model provider is invoked and no value is invented.

import { join } from "node:path";
import { flagEnabled, optionalOption, requireOption, runCli, type Args } from "./lib/cli.ts";
import {
  ARTIFACT_FILES,
  SUITE_FILE,
  buildRunDir,
  readRunnerVersion,
  toLogPath,
  utcDateStamp,
  writeJsonFile,
  writeTextFile,
} from "./lib/run.ts";
import { loadConstraints, loadInstructions, selectScenarios } from "./lib/scenario.ts";
import {
  buildDryRunTranscript,
  buildMetadata,
  buildSuite,
  emptyQualityScores,
  emptyTokenUsage,
} from "./lib/artifacts.ts";

const USAGE = `Usage: bun scripts/run-suite.ts --kit-version <version> --kit-ref <ref> --model-profile <profile> [options]

Options:
  --kit-version <value>    Version label of the kit under evaluation (required)
  --kit-ref <value>        Git ref of the kit checkout (required)
  --kit-commit <sha>       Resolved commit of the kit checkout (optional)
  --scenario <id|all>      Scenario to run, default "all"
  --model-profile <value>  Model profile recorded in the run path (required)
  --output-dir <path>      Base directory for runs, default "runs"
  --dry-run                Generate placeholder artifacts without invoking a model
  --help                   Print this help

Environment:
  DRY_RUN=1                Same as --dry-run

Layout:
  <output-dir>/<kit-version>/<YYYY-MM-DD>-<model-profile>/suite.json
  <output-dir>/<kit-version>/<YYYY-MM-DD>-<model-profile>/<scenario>/<artifacts>

Output:
  One "wrote <path>" line per artifact and a final "RUN_DIR=<path>" line.`;

function isDryRun(args: Args): boolean {
  const envValue = process.env.DRY_RUN;
  return flagEnabled(args, "dry-run") || envValue === "1" || envValue === "true";
}

function runSuite(args: Args): number {
  const kitVersion = requireOption(args, "kit-version");
  const kitRef = requireOption(args, "kit-ref");
  const kitCommit = optionalOption(args, "kit-commit", "");
  const modelProfile = requireOption(args, "model-profile");
  const selector = optionalOption(args, "scenario", "all");
  const outputDir = optionalOption(args, "output-dir", "runs");

  if (!isDryRun(args)) {
    process.stderr.write(
      "live mode is not implemented yet: no model provider is wired. Re-run with --dry-run or DRY_RUN=1.\n",
    );
    return 1;
  }

  const now = new Date();
  const executedAt = now.toISOString();
  const runnerVersion = readRunnerVersion();
  const runDir = buildRunDir({
    outputDir,
    kitVersion,
    modelProfile,
    date: utcDateStamp(now),
  });
  const scenarios = selectScenarios(selector);

  for (const scenario of scenarios) {
    const scenarioDir = join(runDir, scenario.id);
    const metadata = buildMetadata({
      kitVersion,
      kitRef,
      kitCommit: kitCommit.length > 0 ? kitCommit : null,
      scenario,
      modelProfile,
      executedAt,
      runnerVersion,
      status: "dry-run",
      mode: "dry-run",
    });
    const tokenUsage = emptyTokenUsage("dry-run");
    const qualityScores = emptyQualityScores("dry-run");
    const transcript = buildDryRunTranscript({
      scenario,
      constraints: loadConstraints(scenario),
      instructions: loadInstructions(scenario),
      executedAt,
      kitVersion,
      modelProfile,
    });

    writeJsonFile(join(scenarioDir, "metadata.json"), metadata);
    writeJsonFile(join(scenarioDir, "token-usage.json"), tokenUsage);
    writeJsonFile(join(scenarioDir, "quality-scores.json"), qualityScores);
    writeTextFile(join(scenarioDir, "transcript.md"), transcript);
    writeTextFile(join(scenarioDir, "tool-calls.jsonl"), "");

    for (const file of ARTIFACT_FILES) {
      process.stdout.write(`wrote ${toLogPath(join(scenarioDir, file))}\n`);
    }
  }

  const suitePath = join(runDir, SUITE_FILE);
  writeJsonFile(
    suitePath,
    buildSuite({
      kitVersion,
      kitRef,
      kitCommit: kitCommit.length > 0 ? kitCommit : null,
      modelProfile,
      executedAt,
      runnerVersion,
      mode: "dry-run",
      scenarios: scenarios.map((scenario) => scenario.id),
    }),
  );
  process.stdout.write(`wrote ${toLogPath(suitePath)}\n`);
  process.stdout.write(`RUN_DIR=${toLogPath(runDir)}\n`);
  return 0;
}

runCli(USAGE, runSuite);
