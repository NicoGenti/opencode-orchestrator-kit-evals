// Artifact types, dry-run artifact builders and cross-field invariants that a
// JSON schema cannot express.

import type { Constraints, Scenario } from "./scenario.ts";
import type { RunMode, RunStatus } from "./run.ts";

export type Metadata = {
  kitVersion: string;
  kitRef: string;
  kitCommit: string | null;
  scenario: string;
  modelProfile: string;
  executedAt: string;
  runnerVersion: string;
  status: RunStatus;
  mode: RunMode;
};

export type TokenUsage = {
  mode: RunMode;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  toolCallCount: number | null;
  durationSeconds: number | null;
  estimatedCostUsd: number | null;
};

export type QualityScores = {
  mode: RunMode;
  taskCompletion: number | null;
  correctness: number | null;
  routing: number | null;
  constraintAdherence: number | null;
  efficiency: number | null;
  safety: "pass" | "fail" | null;
  total: number | null;
  max: number | null;
};

export type Suite = {
  schemaVersion: number;
  kitVersion: string;
  kitRef: string;
  kitCommit: string | null;
  modelProfile: string;
  executedAt: string;
  runnerVersion: string;
  mode: RunMode;
  scenarios: readonly string[];
};

export const SUITE_SCHEMA_VERSION = 1;

export const QUALITY_DIMENSIONS = [
  "taskCompletion",
  "correctness",
  "routing",
  "constraintAdherence",
  "efficiency",
] as const;

export const QUALITY_MAX_TOTAL = 15;

// DRY_RUN never measures anything: every metric stays null so no artifact can
// be mistaken for a real measurement.
export function emptyTokenUsage(mode: RunMode): TokenUsage {
  return {
    mode,
    promptTokens: null,
    completionTokens: null,
    totalTokens: null,
    toolCallCount: null,
    durationSeconds: null,
    estimatedCostUsd: null,
  };
}

export function emptyQualityScores(mode: RunMode): QualityScores {
  return {
    mode,
    taskCompletion: null,
    correctness: null,
    routing: null,
    constraintAdherence: null,
    efficiency: null,
    safety: null,
    total: null,
    max: null,
  };
}

export function buildMetadata(input: {
  kitVersion: string;
  kitRef: string;
  kitCommit: string | null;
  scenario: Scenario;
  modelProfile: string;
  executedAt: string;
  runnerVersion: string;
  status: RunStatus;
  mode: RunMode;
}): Metadata {
  return {
    kitVersion: input.kitVersion,
    kitRef: input.kitRef,
    kitCommit: input.kitCommit,
    scenario: input.scenario.id,
    modelProfile: input.modelProfile,
    executedAt: input.executedAt,
    runnerVersion: input.runnerVersion,
    status: input.status,
    mode: input.mode,
  };
}

export function buildSuite(input: {
  kitVersion: string;
  kitRef: string;
  kitCommit: string | null;
  modelProfile: string;
  executedAt: string;
  runnerVersion: string;
  mode: RunMode;
  scenarios: readonly string[];
}): Suite {
  return {
    schemaVersion: SUITE_SCHEMA_VERSION,
    kitVersion: input.kitVersion,
    kitRef: input.kitRef,
    kitCommit: input.kitCommit,
    modelProfile: input.modelProfile,
    executedAt: input.executedAt,
    runnerVersion: input.runnerVersion,
    mode: input.mode,
    scenarios: [...input.scenarios].sort(),
  };
}

export function buildDryRunTranscript(input: {
  scenario: Scenario;
  constraints: Constraints;
  instructions: string;
  executedAt: string;
  kitVersion: string;
  modelProfile: string;
}): string {
  return [
    `# Dry run: ${input.scenario.id}`,
    "",
    `- Executed at: \`${input.executedAt}\``,
    `- Kit version: \`${input.kitVersion}\``,
    `- Model profile: \`${input.modelProfile}\``,
    `- Fixture: \`${input.scenario.repositoryFixture}\` (${input.scenario.fixtureStatus})`,
    "",
    "## Status",
    "",
    "This transcript was produced in DRY_RUN mode. No model provider was invoked,",
    "no tool was executed and no token, cost or quality value was measured.",
    "Every numeric field in `token-usage.json` and `quality-scores.json` is `null`.",
    "`tool-calls.jsonl` is intentionally empty.",
    "",
    "## Scenario instructions (not executed)",
    "",
    "```text",
    input.instructions,
    "```",
    "",
    "## Deterministic constraints (not checked in DRY_RUN)",
    "",
    "```json",
    JSON.stringify(input.constraints, null, 2),
    "```",
    "",
  ].join("\n");
}

// Invariants that span several fields or several artifacts of the same run.
export function checkArtifactInvariants(input: {
  metadata: Metadata;
  tokenUsage: TokenUsage;
  qualityScores: QualityScores;
}): readonly string[] {
  const errors: string[] = [];
  const { metadata, tokenUsage, qualityScores } = input;

  if (tokenUsage.mode !== metadata.mode) {
    errors.push(`token-usage.json: mode "${tokenUsage.mode}" differs from metadata mode "${metadata.mode}"`);
  }
  if (qualityScores.mode !== metadata.mode) {
    errors.push(`quality-scores.json: mode "${qualityScores.mode}" differs from metadata mode "${metadata.mode}"`);
  }

  const tokenValues = [
    tokenUsage.promptTokens,
    tokenUsage.completionTokens,
    tokenUsage.totalTokens,
  ];
  if (tokenValues.every((value) => value !== null)) {
    if (tokenUsage.totalTokens !== tokenUsage.promptTokens! + tokenUsage.completionTokens!) {
      errors.push("token-usage.json: totalTokens must equal promptTokens + completionTokens");
    }
  } else if (tokenValues.some((value) => value !== null)) {
    errors.push("token-usage.json: promptTokens, completionTokens and totalTokens must be null together");
  }
  if (metadata.mode === "live" && tokenUsage.totalTokens === null) {
    errors.push('token-usage.json: a "live" run must report totalTokens');
  }

  const dimensions = QUALITY_DIMENSIONS.map((key) => qualityScores[key]);
  if (dimensions.every((value) => value !== null)) {
    if (qualityScores.total === null) {
      errors.push("quality-scores.json: total must be set when all dimensions are scored");
    } else if (qualityScores.total !== dimensions.reduce((sum, value) => sum + value!, 0)) {
      errors.push("quality-scores.json: total must equal the sum of the five dimensions");
    }
    if (qualityScores.max !== QUALITY_MAX_TOTAL) {
      errors.push(`quality-scores.json: max must be ${QUALITY_MAX_TOTAL}`);
    }
    if (qualityScores.safety === null) {
      errors.push("quality-scores.json: safety must be \"pass\" or \"fail\" when a run is scored");
    }
  } else if (dimensions.some((value) => value !== null)) {
    errors.push("quality-scores.json: all five dimensions must be scored together");
  }

  return errors;
}

export function checkSuite(suite: unknown): readonly string[] {
  if (typeof suite !== "object" || suite === null || Array.isArray(suite)) {
    return ["suite.json: must be a JSON object"];
  }
  const record = suite as Record<string, unknown>;
  const errors: string[] = [];
  if (record.schemaVersion !== SUITE_SCHEMA_VERSION) {
    errors.push(`suite.json: field "schemaVersion" must be ${SUITE_SCHEMA_VERSION}`);
  }
  for (const key of ["kitVersion", "kitRef", "modelProfile", "executedAt", "runnerVersion"] as const) {
    const value = record[key];
    if (typeof value !== "string" || value.trim().length === 0) {
      errors.push(`suite.json: field "${key}" must be a non-empty string`);
    }
  }
  if (record.mode !== "dry-run" && record.mode !== "live") {
    errors.push('suite.json: field "mode" must be "dry-run" or "live"');
  }
  const scenarios = record.scenarios;
  if (!Array.isArray(scenarios) || scenarios.length === 0) {
    errors.push('suite.json: field "scenarios" must be a non-empty array');
  } else if (scenarios.some((entry) => typeof entry !== "string" || entry.trim().length === 0)) {
    errors.push('suite.json: field "scenarios" must contain only non-empty strings');
  }
  return errors;
}
