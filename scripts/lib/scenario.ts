// Loading and validation of scenario definitions.
// Scenario files are data: every field is checked here so the runner never
// works with a partially valid definition.

import { existsSync } from "node:fs";
import { join } from "node:path";
import { UsageError } from "./cli.ts";
import { SCENARIOS_DIR, listDirectoryNames, readJsonFile, readTextFile } from "./run.ts";

export const FORBIDDEN_ACTION_VOCABULARY = [
  "config-modification",
  "dependency-install",
  "file-deletion",
  "git-push",
  "network-access",
] as const;

export type ForbiddenAction = (typeof FORBIDDEN_ACTION_VOCABULARY)[number];

export type Scenario = {
  id: string;
  description: string;
  repositoryFixture: string;
  fixtureStatus: "placeholder" | "available";
  modelProfile: string;
  timeoutSeconds: number;
  instructionsFile: string;
  constraintsFile: string;
  expectedArtifacts: readonly string[];
};

export type Constraints = {
  scenario: string;
  requiredFiles: readonly string[];
  forbiddenActions: readonly ForbiddenAction[];
  forbiddenPathPatterns: readonly string[];
  requiredOutputFormat: string;
  maximumToolCalls: number;
};

function fail(path: string, message: string): never {
  throw new Error(`${path}: ${message}`);
}

function requireString(path: string, record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    fail(path, `field "${key}" must be a non-empty string`);
  }
  return value.trim();
}

function requirePositiveInteger(
  path: string,
  record: Record<string, unknown>,
  key: string,
): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    fail(path, `field "${key}" must be a positive integer`);
  }
  return value;
}

function requireStringArray(
  path: string,
  record: Record<string, unknown>,
  key: string,
): readonly string[] {
  const value = record[key];
  if (!Array.isArray(value) || value.length === 0) {
    fail(path, `field "${key}" must be a non-empty array`);
  }
  return value.map((entry, index) => {
    if (typeof entry !== "string" || entry.trim().length === 0) {
      fail(path, `field "${key}[${index}]" must be a non-empty string`);
    }
    return entry.trim();
  });
}

export function scenarioDirectory(id: string, scenariosDir: string = SCENARIOS_DIR): string {
  return join(scenariosDir, id);
}

export function listScenarioIds(scenariosDir: string = SCENARIOS_DIR): readonly string[] {
  return listDirectoryNames(scenariosDir);
}

export function loadScenario(id: string, scenariosDir: string = SCENARIOS_DIR): Scenario {
  const directory = scenarioDirectory(id, scenariosDir);
  const path = join(directory, "scenario.json");
  if (!existsSync(path)) {
    fail(path, "scenario.json is missing");
  }
  const raw = readJsonFile<Record<string, unknown>>(path);
  const fixtureStatus = raw.fixtureStatus;
  if (fixtureStatus !== "placeholder" && fixtureStatus !== "available") {
    fail(path, 'field "fixtureStatus" must be "placeholder" or "available"');
  }
  const scenario: Scenario = {
    id: requireString(path, raw, "id"),
    description: requireString(path, raw, "description"),
    repositoryFixture: requireString(path, raw, "repositoryFixture"),
    fixtureStatus,
    modelProfile: requireString(path, raw, "modelProfile"),
    timeoutSeconds: requirePositiveInteger(path, raw, "timeoutSeconds"),
    instructionsFile: requireString(path, raw, "instructionsFile"),
    constraintsFile: requireString(path, raw, "constraintsFile"),
    expectedArtifacts: requireStringArray(path, raw, "expectedArtifacts"),
  };
  if (scenario.id !== id) {
    fail(path, `field "id" ("${scenario.id}") must match its directory name ("${id}")`);
  }
  for (const file of [scenario.instructionsFile, scenario.constraintsFile]) {
    if (!existsSync(join(directory, file))) {
      fail(path, `referenced file "${file}" does not exist`);
    }
  }
  return scenario;
}

export function loadConstraints(
  scenario: Scenario,
  scenariosDir: string = SCENARIOS_DIR,
): Constraints {
  const path = join(scenarioDirectory(scenario.id, scenariosDir), scenario.constraintsFile);
  const raw = readJsonFile<Record<string, unknown>>(path);
  const actions = requireStringArray(path, raw, "forbiddenActions");
  for (const action of actions) {
    if (!(FORBIDDEN_ACTION_VOCABULARY as readonly string[]).includes(action)) {
      fail(
        path,
        `unknown forbidden action "${action}"; allowed values: ${FORBIDDEN_ACTION_VOCABULARY.join(", ")}`,
      );
    }
  }
  const constraints: Constraints = {
    scenario: requireString(path, raw, "scenario"),
    requiredFiles: requireStringArray(path, raw, "requiredFiles"),
    forbiddenActions: actions as readonly ForbiddenAction[],
    forbiddenPathPatterns: requireStringArray(path, raw, "forbiddenPathPatterns"),
    requiredOutputFormat: requireString(path, raw, "requiredOutputFormat"),
    maximumToolCalls: requirePositiveInteger(path, raw, "maximumToolCalls"),
  };
  if (constraints.scenario !== scenario.id) {
    fail(path, `field "scenario" must equal "${scenario.id}"`);
  }
  return constraints;
}

export function loadInstructions(
  scenario: Scenario,
  scenariosDir: string = SCENARIOS_DIR,
): string {
  const path = join(scenarioDirectory(scenario.id, scenariosDir), scenario.instructionsFile);
  const text = readTextFile(path).trim();
  if (text.length === 0) {
    fail(path, "instructions must not be empty");
  }
  return text;
}

export function selectScenarios(
  selector: string,
  scenariosDir: string = SCENARIOS_DIR,
): readonly Scenario[] {
  const available = listScenarioIds(scenariosDir);
  const ids = selector === "all" ? available : [selector];
  return ids.map((id) => {
    if (!available.includes(id)) {
      throw new UsageError(`unknown scenario "${id}"; available: ${available.join(", ")} or "all"`);
    }
    return loadScenario(id, scenariosDir);
  });
}
