// Validates one run directory: suite.json, the five artifacts of every
// scenario, their JSON schemas and the cross-field invariants.
//
// Exit codes: 0 = valid, 1 = invalid run directory, 2 = usage error.

import { existsSync } from "node:fs";
import { join } from "node:path";
import { requireOption, runCli, type Args } from "./lib/cli.ts";
import {
  SUITE_FILE,
  readJsonFile,
  readTextFile,
  toLogPath,
} from "./lib/run.ts";
import {
  checkArtifactInvariants,
  checkSuite,
  type Metadata,
  type QualityScores,
  type Suite,
  type TokenUsage,
} from "./lib/artifacts.ts";
import { validateArtifact, type SchemaName } from "./lib/schemas.ts";

const USAGE = `Usage: bun scripts/validate-run.ts --run-dir <path>

Checks suite.json and, for every scenario listed in it, the five artifacts
required by the artifact contract: presence, JSON syntax, JSON schema and
cross-field invariants.

Exit codes:
  0  the run directory is valid
  1  the run directory is invalid (every problem is listed on stderr)
  2  usage error`;

function requireArtifact<T>(
  errors: string[],
  scenarioDir: string,
  scenarioId: string,
  file: string,
  schemaName: SchemaName,
): T | undefined {
  const path = join(scenarioDir, file);
  if (!existsSync(path)) {
    errors.push(`${scenarioId}/${file}: missing`);
    return undefined;
  }
  let value: unknown;
  try {
    value = readJsonFile(path);
  } catch (error) {
    errors.push(`${scenarioId}/${file}: invalid JSON (${(error as Error).message})`);
    return undefined;
  }
  const schemaErrors = validateArtifact(schemaName, value);
  for (const message of schemaErrors) {
    errors.push(`${scenarioId}/${file}: ${message}`);
  }
  return schemaErrors.length === 0 ? (value as T) : undefined;
}

function validateScenario(
  errors: string[],
  runDir: string,
  suite: Suite,
  scenarioId: string,
): void {
  const scenarioDir = join(runDir, scenarioId);
  if (!existsSync(scenarioDir)) {
    errors.push(`${scenarioId}: scenario directory is missing`);
    return;
  }

  const metadata = requireArtifact<Metadata>(errors, scenarioDir, scenarioId, "metadata.json", "metadata");
  const tokenUsage = requireArtifact<TokenUsage>(errors, scenarioDir, scenarioId, "token-usage.json", "token-usage");
  const qualityScores = requireArtifact<QualityScores>(
    errors,
    scenarioDir,
    scenarioId,
    "quality-scores.json",
    "quality-scores",
  );

  if (metadata !== undefined) {
    if (metadata.scenario !== scenarioId) {
      errors.push(`${scenarioId}/metadata.json: scenario "${metadata.scenario}" does not match the directory`);
    }
    const suiteFields = ["kitVersion", "kitRef", "kitCommit", "modelProfile", "executedAt", "runnerVersion"] as const;
    for (const field of suiteFields) {
      if (metadata[field] !== suite[field]) {
        errors.push(`${scenarioId}/metadata.json: "${field}" differs from suite.json`);
      }
    }
    if (metadata.mode !== suite.mode) {
      errors.push(`${scenarioId}/metadata.json: mode differs from suite.json`);
    }
  }

  if (metadata !== undefined && tokenUsage !== undefined && qualityScores !== undefined) {
    for (const message of checkArtifactInvariants({ metadata, tokenUsage, qualityScores })) {
      errors.push(`${scenarioId}: ${message}`);
    }
  }

  const transcriptPath = join(scenarioDir, "transcript.md");
  if (!existsSync(transcriptPath)) {
    errors.push(`${scenarioId}/transcript.md: missing`);
  } else {
    const transcript = readTextFile(transcriptPath);
    if (transcript.trim().length === 0) {
      errors.push(`${scenarioId}/transcript.md: must not be empty`);
    }
    if (suite.mode === "dry-run" && !transcript.includes("DRY_RUN")) {
      errors.push(`${scenarioId}/transcript.md: a dry-run transcript must state that it is a DRY_RUN`);
    }
  }

  const toolCallsPath = join(scenarioDir, "tool-calls.jsonl");
  if (!existsSync(toolCallsPath)) {
    errors.push(`${scenarioId}/tool-calls.jsonl: missing`);
  } else {
    const lines = readTextFile(toolCallsPath)
      .split("\n")
      .filter((line) => line.trim().length > 0);
    if (suite.mode === "dry-run" && lines.length > 0) {
      errors.push(`${scenarioId}/tool-calls.jsonl: a dry-run must not record tool calls`);
    }
    lines.forEach((line, index) => {
      try {
        const parsed: unknown = JSON.parse(line);
        if (typeof parsed !== "object" || parsed === null) {
          errors.push(`${scenarioId}/tool-calls.jsonl:${index + 1}: must be a JSON object`);
        }
      } catch {
        errors.push(`${scenarioId}/tool-calls.jsonl:${index + 1}: invalid JSON`);
      }
    });
  }
}

function validateRun(args: Args): number {
  const runDir = requireOption(args, "run-dir");
  const errors: string[] = [];

  if (!existsSync(runDir)) {
    process.stderr.write(`run directory "${runDir}" does not exist\n`);
    return 1;
  }

  const suitePath = join(runDir, SUITE_FILE);
  if (!existsSync(suitePath)) {
    process.stderr.write(`${SUITE_FILE}: missing in ${runDir}\n`);
    return 1;
  }
  let suite: unknown;
  try {
    suite = readJsonFile<unknown>(suitePath);
  } catch (error) {
    process.stderr.write(`${SUITE_FILE}: invalid JSON (${(error as Error).message})\n`);
    return 1;
  }
  for (const message of checkSuite(suite)) {
    errors.push(message);
  }
  if (errors.length > 0) {
    return report(errors, runDir);
  }

  const validSuite = suite as Suite;
  for (const scenarioId of validSuite.scenarios) {
    validateScenario(errors, runDir, validSuite, scenarioId);
  }

  if (errors.length > 0) {
    return report(errors, runDir);
  }
  process.stdout.write(
    `OK ${toLogPath(runDir)} (${validSuite.scenarios.length} scenarios, mode ${validSuite.mode})\n`,
  );
  return 0;
}

function report(errors: readonly string[], runDir: string): number {
  process.stderr.write(`FAILED ${toLogPath(runDir)} (${errors.length} problems)\n`);
  for (const message of errors) {
    process.stderr.write(`- ${message}\n`);
  }
  return 1;
}

runCli(USAGE, validateRun);
