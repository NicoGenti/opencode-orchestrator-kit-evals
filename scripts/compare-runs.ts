// Compares two run directories scenario by scenario.
//
// Only observable values are compared: a null metric (dry run, or a metric the
// runner could not measure) is reported as "n/a" and never compared.
//
// Exit codes: 0 = compared, 1 = gate failed (only with --gate), 2 = usage error.

import { existsSync } from "node:fs";
import { join } from "node:path";
import { flagEnabled, requireOption, runCli, type Args } from "./lib/cli.ts";
import { SUITE_FILE, readJsonFile, toLogPath } from "./lib/run.ts";
import { type QualityScores, type Suite, type TokenUsage } from "./lib/artifacts.ts";

const USAGE = `Usage: bun scripts/compare-runs.ts --baseline <run-dir> --current <run-dir> [--gate]

Prints a Markdown comparison table, one row per scenario.

--gate  also fails the comparison when a scenario listed in the baseline is
        missing from the current run, or when the quality total drops.

Token budgets in baselines/token-budgets.json are not enforced yet; see
methodology.md for the baseline update policy.

Exit codes: 0 = compared/gate passed, 1 = gate failed, 2 = usage error.`;

type ScenarioComparison = {
  id: string;
  baselineStatus: string;
  currentStatus: string;
  baselineTokens: number | null;
  currentTokens: number | null;
  baselineQuality: number | null;
  currentQuality: number | null;
  missing: boolean;
};

function formatValue(value: number | null): string {
  return value === null ? "n/a" : String(value);
}

function formatDelta(baseline: number | null, current: number | null): string {
  if (baseline === null || current === null) {
    return "n/a";
  }
  const delta = current - baseline;
  return delta > 0 ? `+${delta}` : String(delta);
}

function readSuite(runDir: string): Suite {
  const path = join(runDir, SUITE_FILE);
  if (!existsSync(path)) {
    throw new Error(`${toLogPath(path)} is missing: not a run directory`);
  }
  return readJsonFile<Suite>(path);
}

function readScenarioValue<T>(runDir: string, scenarioId: string, file: string): T | null {
  const path = join(runDir, scenarioId, file);
  if (!existsSync(path)) {
    return null;
  }
  return readJsonFile<T>(path);
}

function compareScenario(
  baselineDir: string,
  currentDir: string,
  scenarioId: string,
): ScenarioComparison {
  const baselineToken = readScenarioValue<TokenUsage>(baselineDir, scenarioId, "token-usage.json");
  const currentToken = readScenarioValue<TokenUsage>(currentDir, scenarioId, "token-usage.json");
  const baselineQuality = readScenarioValue<QualityScores>(baselineDir, scenarioId, "quality-scores.json");
  const currentQuality = readScenarioValue<QualityScores>(currentDir, scenarioId, "quality-scores.json");
  return {
    id: scenarioId,
    baselineStatus: baselineToken === null ? "absent" : String(baselineQuality?.mode ?? "unknown"),
    currentStatus: currentToken === null ? "absent" : String(currentQuality?.mode ?? "unknown"),
    baselineTokens: baselineToken?.totalTokens ?? null,
    currentTokens: currentToken?.totalTokens ?? null,
    baselineQuality: baselineQuality?.total ?? null,
    currentQuality: currentQuality?.total ?? null,
    missing: currentToken === null,
  };
}

function compareRuns(args: Args): number {
  const baselineDir = requireOption(args, "baseline");
  const currentDir = requireOption(args, "current");
  const gate = flagEnabled(args, "gate");

  const baselineSuite = readSuite(baselineDir);
  const currentSuite = readSuite(currentDir);
  const ids = [...new Set([...baselineSuite.scenarios, ...currentSuite.scenarios])].sort();
  const rows = ids.map((id) => compareScenario(baselineDir, currentDir, id));

  process.stdout.write(`## Comparison\n\n`);
  process.stdout.write(`- Baseline: \`${toLogPath(baselineDir)}\` (${baselineSuite.kitVersion}, ${baselineSuite.mode})\n`);
  process.stdout.write(`- Current: \`${toLogPath(currentDir)}\` (${currentSuite.kitVersion}, ${currentSuite.mode})\n\n`);
  process.stdout.write("| scenario | baseline mode | current mode | baseline tokens | current tokens | delta tokens | baseline score | current score | delta score |\n");
  process.stdout.write("| --- | --- | --- | --- | --- | --- | --- | --- | --- |\n");
  for (const row of rows) {
    process.stdout.write(
      `| ${row.id} | ${row.baselineStatus} | ${row.currentStatus} | ${formatValue(row.baselineTokens)} | ${formatValue(row.currentTokens)} | ${formatDelta(row.baselineTokens, row.currentTokens)} | ${formatValue(row.baselineQuality)} | ${formatValue(row.currentQuality)} | ${formatDelta(row.baselineQuality, row.currentQuality)} |\n`,
    );
  }

  if (!gate) {
    return 0;
  }

  const failures: string[] = [];
  for (const row of rows) {
    if (row.missing) {
      failures.push(`${row.id}: missing from the current run`);
    }
    if (row.baselineQuality !== null && row.currentQuality !== null && row.currentQuality < row.baselineQuality) {
      failures.push(`${row.id}: quality total dropped from ${row.baselineQuality} to ${row.currentQuality}`);
    }
  }
  if (failures.length > 0) {
    process.stderr.write(`\nGate failed:\n`);
    for (const failure of failures) {
      process.stderr.write(`- ${failure}\n`);
    }
    return 1;
  }
  process.stdout.write("\nGate passed.\n");
  return 0;
}

runCli(USAGE, compareRuns);
