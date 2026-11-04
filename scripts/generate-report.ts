// Renders a Markdown report from one run directory.
// The report only tabulates values that are present in the run artifacts; an
// unmeasured metric is rendered as "not measured".
//
// Exit codes: 0 = report written, 1 = unreadable run directory, 2 = usage error.

import { join } from "node:path";
import { optionalOption, requireOption, runCli, type Args } from "./lib/cli.ts";
import {
  REPORTS_DIR,
  SUITE_FILE,
  readJsonFile,
  toLogPath,
  writeTextFile,
} from "./lib/run.ts";
import {
  QUALITY_DIMENSIONS,
  type Metadata,
  type QualityScores,
  type Suite,
  type TokenUsage,
} from "./lib/artifacts.ts";

const USAGE = `Usage: bun scripts/generate-report.ts --run-dir <path> [--out <file>]

Writes a Markdown report for the run directory. Default output path:
  reports/<YYYY-MM-DD>-<kit-version>-<model-profile>.md

Exit codes: 0 = report written, 1 = unreadable run directory, 2 = usage error.`;

function renderValue(value: number | string | null): string {
  return value === null ? "not measured" : String(value);
}

function renderScenario(runDir: string, scenarioId: string): string {
  const metadata = readJsonFile<Metadata>(join(runDir, scenarioId, "metadata.json"));
  const tokenUsage = readJsonFile<TokenUsage>(join(runDir, scenarioId, "token-usage.json"));
  const qualityScores = readJsonFile<QualityScores>(join(runDir, scenarioId, "quality-scores.json"));

  const lines: string[] = [`### ${scenarioId}`, "", `Status: \`${metadata.status}\``, ""];
  lines.push("| metric | value |", "| --- | --- |");
  lines.push(`| prompt tokens | ${renderValue(tokenUsage.promptTokens)} |`);
  lines.push(`| completion tokens | ${renderValue(tokenUsage.completionTokens)} |`);
  lines.push(`| total tokens | ${renderValue(tokenUsage.totalTokens)} |`);
  lines.push(`| tool calls | ${renderValue(tokenUsage.toolCallCount)} |`);
  lines.push(`| duration (s) | ${renderValue(tokenUsage.durationSeconds)} |`);
  lines.push(`| estimated cost (USD) | ${renderValue(tokenUsage.estimatedCostUsd)} |`);
  for (const dimension of QUALITY_DIMENSIONS) {
    lines.push(`| ${dimension} (0-3) | ${renderValue(qualityScores[dimension])} |`);
  }
  lines.push(`| safety | ${renderValue(qualityScores.safety)} |`);
  lines.push(`| total score | ${renderValue(qualityScores.total)} / ${renderValue(qualityScores.max)} |`);
  lines.push("");
  return lines.join("\n");
}

function generateReport(args: Args): number {
  const runDir = requireOption(args, "run-dir");
  const suite = readJsonFile<Suite>(join(runDir, SUITE_FILE));
  const outPath = optionalOption(
    args,
    "out",
    join(
      REPORTS_DIR,
      `${suite.executedAt.slice(0, 10)}-${suite.kitVersion}-${suite.modelProfile}.md`,
    ),
  );

  const lines: string[] = [
    `# Evaluation report: ${suite.kitVersion} / ${suite.modelProfile}`,
    "",
    "| run field | value |",
    "| --- | --- |",
    `| kit ref | \`${suite.kitRef}\` |`,
    `| kit commit | ${suite.kitCommit === null ? "unknown" : `\`${suite.kitCommit}\``} |`,
    `| executed at | \`${suite.executedAt}\` |`,
    `| runner version | \`${suite.runnerVersion}\` |`,
    `| mode | \`${suite.mode}\` |`,
    `| scenarios | ${suite.scenarios.join(", ")} |`,
    "",
  ];

  if (suite.mode === "dry-run") {
    lines.push(
      "> This run used DRY_RUN mode. No model was invoked and no metric was measured:",
      "> every numeric value below is intentionally null.",
      "",
    );
  }

  for (const scenarioId of suite.scenarios) {
    lines.push(renderScenario(runDir, scenarioId));
  }

  writeTextFile(outPath, `${lines.join("\n").trimEnd()}\n`);
  process.stdout.write(`wrote ${toLogPath(outPath)}\n`);
  return 0;
}

runCli(USAGE, generateReport);
