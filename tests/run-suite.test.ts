import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { ARTIFACTS, BASE_ARGS, expectRunDir, makeScratchDir, runScript, toPortable } from "./helpers.ts";

const scratchRoot = makeScratchDir("evals-run-");

afterAll(() => {
  rmSync(scratchRoot, { recursive: true, force: true });
});

describe("run-suite", () => {
  test("writes the five artifacts of one scenario and prints the run directory", () => {
    const outputDir = toPortable(join(scratchRoot, "single"));
    const result = runScript([...BASE_ARGS, "--scenario", "bugfix", "--output-dir", outputDir, "--dry-run"]);

    expect(result.code).toBe(0);
    const runDir = expectRunDir(result);
    expect(runDir).toMatch(/\/1\.0\.0\/\d{4}-\d{2}-\d{2}-default$/);
    for (const artifact of ARTIFACTS) {
      expect(existsSync(join(runDir, "bugfix", artifact))).toBe(true);
    }

    const metadata = JSON.parse(readFileSync(join(runDir, "bugfix", "metadata.json"), "utf8")) as Record<string, unknown>;
    expect(metadata.scenario).toBe("bugfix");
    expect(metadata.mode).toBe("dry-run");
    expect(metadata.status).toBe("dry-run");
    expect(metadata.kitVersion).toBe("1.0.0");
    expect(metadata.kitCommit).toBeNull();
  });

  test("never invents a metric in dry run", () => {
    const outputDir = toPortable(join(scratchRoot, "nulls"));
    const runDir = expectRunDir(
      runScript([...BASE_ARGS, "--scenario", "bugfix", "--output-dir", outputDir, "--dry-run"]),
    );

    const tokenUsage = JSON.parse(readFileSync(join(runDir, "bugfix", "token-usage.json"), "utf8")) as Record<string, unknown>;
    expect(tokenUsage).toEqual({
      mode: "dry-run",
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
      toolCallCount: null,
      durationSeconds: null,
      estimatedCostUsd: null,
    });

    const qualityScores = JSON.parse(readFileSync(join(runDir, "bugfix", "quality-scores.json"), "utf8")) as Record<string, unknown>;
    expect(qualityScores).toEqual({
      mode: "dry-run",
      taskCompletion: null,
      correctness: null,
      routing: null,
      constraintAdherence: null,
      efficiency: null,
      safety: null,
      total: null,
      max: null,
    });

    expect(readFileSync(join(runDir, "bugfix", "tool-calls.jsonl"), "utf8")).toBe("");
  });

  test("--scenario all writes one directory per scenario and a sorted suite.json", () => {
    const outputDir = toPortable(join(scratchRoot, "all"));
    const runDir = expectRunDir(runScript([...BASE_ARGS, "--output-dir", outputDir, "--dry-run"]));

    const suite = JSON.parse(readFileSync(join(runDir, "suite.json"), "utf8")) as { scenarios: string[]; mode: string };
    expect(suite.scenarios).toEqual(["bugfix", "feature-request", "refactor"]);
    expect(suite.mode).toBe("dry-run");
    for (const scenarioId of suite.scenarios) {
      expect(existsSync(join(runDir, scenarioId, "transcript.md"))).toBe(true);
    }
  });

  test("DRY_RUN=1 behaves like --dry-run", () => {
    const outputDir = toPortable(join(scratchRoot, "env"));
    const result = runScript([...BASE_ARGS, "--scenario", "refactor", "--output-dir", outputDir], {
      DRY_RUN: "1",
    });
    expect(result.code).toBe(0);
    expect(expectRunDir(result)).toMatch(/-default$/);
  });

  test("refuses to run without DRY_RUN", () => {
    const outputDir = toPortable(join(scratchRoot, "live"));
    const result = runScript([...BASE_ARGS, "--scenario", "bugfix", "--output-dir", outputDir], {
      DRY_RUN: "0",
    });
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("live mode is not implemented yet");
  });

  test("rejects an unknown scenario with exit code 2", () => {
    const result = runScript([...BASE_ARGS, "--scenario", "does-not-exist", "--dry-run"]);
    expect(result.code).toBe(2);
    expect(result.stderr).toContain('unknown scenario "does-not-exist"');
  });

  test("rejects a path-unsafe kit version with exit code 2", () => {
    const result = runScript([
      "scripts/run-suite.ts",
      "--kit-version",
      "../escape",
      "--kit-ref",
      "main",
      "--model-profile",
      "default",
      "--dry-run",
    ]);
    expect(result.code).toBe(2);
    expect(result.stderr).toContain("invalid kit version");
  });
});
