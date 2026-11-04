// Shared helpers for the CLI-level tests: every test drives the real scripts
// through `bun`, exactly like the workflows do.

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const REPO_ROOT = join(import.meta.dir, "..");

export const ARTIFACTS = [
  "metadata.json",
  "token-usage.json",
  "quality-scores.json",
  "transcript.md",
  "tool-calls.jsonl",
] as const;

export const BASE_ARGS = [
  "scripts/run-suite.ts",
  "--kit-version",
  "1.0.0",
  "--kit-ref",
  "main",
  "--model-profile",
  "default",
] as const;

export type CliResult = {
  code: number;
  stdout: string;
  stderr: string;
};

export function runScript(args: readonly string[], env: Record<string, string> = {}): CliResult {
  const result = Bun.spawnSync({
    cmd: ["bun", ...args],
    cwd: REPO_ROOT,
    env: { ...process.env, ...env },
    stdout: "pipe",
    stderr: "pipe",
  });
  return {
    code: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  };
}

export function makeScratchDir(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

export function toPortable(path: string): string {
  return path.replaceAll("\\", "/");
}

export function expectRunDir(result: CliResult): string {
  const line = result.stdout.split("\n").find((entry) => entry.startsWith("RUN_DIR="));
  if (line === undefined) {
    throw new Error(`RUN_DIR line missing from stdout:\n${result.stdout}\n${result.stderr}`);
  }
  return line.slice("RUN_DIR=".length).trim();
}
