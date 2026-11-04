// Filesystem layout, path safety and JSON helpers shared by all scripts.

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { UsageError } from "./cli.ts";

export const REPO_ROOT = join(import.meta.dir, "..", "..");
export const SCENARIOS_DIR = join(REPO_ROOT, "scenarios");
export const SCHEMAS_DIR = join(REPO_ROOT, "schemas");
export const REPORTS_DIR = join(REPO_ROOT, "reports");

// Written at the root of every run directory; one file per scenario directory below it.
export const SUITE_FILE = "suite.json";

export const ARTIFACT_FILES = [
  "metadata.json",
  "token-usage.json",
  "quality-scores.json",
  "transcript.md",
  "tool-calls.jsonl",
] as const;

export type RunMode = "dry-run" | "live";
export type RunStatus = "dry-run" | "passed" | "failed" | "partial";

const SAFE_PATH_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export function assertPathSegment(label: string, value: string): string {
  if (!SAFE_PATH_SEGMENT.test(value)) {
    throw new UsageError(
      `invalid ${label} "${value}": use letters, digits, dot, underscore or hyphen only`,
    );
  }
  return value;
}

export function utcDateStamp(now: Date): string {
  return now.toISOString().slice(0, 10);
}

// runs/{kit-version}/{YYYY-MM-DD}-{model-profile}/
export function buildRunDir(input: {
  outputDir: string;
  kitVersion: string;
  modelProfile: string;
  date: string;
}): string {
  const kitVersion = assertPathSegment("kit version", input.kitVersion);
  const modelProfile = assertPathSegment("model profile", input.modelProfile);
  return join(input.outputDir, kitVersion, `${input.date}-${modelProfile}`);
}

// Log paths use forward slashes on every platform so CI shell parsing and test
// assertions do not depend on the host separator.
export function toLogPath(path: string): string {
  return path.replaceAll("\\", "/");
}

export function readJsonFile<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

export function readTextFile(path: string): string {
  return readFileSync(path, "utf8");
}

export function writeJsonFile(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function writeTextFile(path: string, value: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, value, "utf8");
}

export function listDirectoryNames(path: string): readonly string[] {
  return readdirSync(path, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

export function readRunnerVersion(): string {
  const pkg = readJsonFile<{ version?: unknown }>(join(REPO_ROOT, "package.json"));
  if (typeof pkg.version !== "string" || pkg.version.trim().length === 0) {
    throw new Error("package.json is missing a non-empty version field");
  }
  return pkg.version.trim();
}
