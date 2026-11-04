import { afterAll, describe, expect, test } from "bun:test";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { expectRunDir, makeScratchDir, runScript, toPortable } from "./helpers.ts";

const scratchRoot = makeScratchDir("evals-compare-");

afterAll(() => {
  rmSync(scratchRoot, { recursive: true, force: true });
});

function createRun(input: { name: string; kitVersion: string; scenario: string }): string {
  const outputDir = toPortable(join(scratchRoot, input.name));
  const result = runScript([
    "scripts/run-suite.ts",
    "--kit-version",
    input.kitVersion,
    "--kit-ref",
    "main",
    "--model-profile",
    "default",
    "--scenario",
    input.scenario,
    "--output-dir",
    outputDir,
    "--dry-run",
  ]);
  expect(result.code).toBe(0);
  return expectRunDir(result);
}

describe("compare-runs", () => {
  test("prints one row per scenario and treats unmeasured metrics as n/a", () => {
    const baseline = createRun({ name: "full", kitVersion: "1.0.0", scenario: "all" });
    const current = createRun({ name: "full-next", kitVersion: "1.1.0", scenario: "all" });

    const result = runScript([
      "scripts/compare-runs.ts",
      "--baseline",
      toPortable(baseline),
      "--current",
      toPortable(current),
    ]);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("| scenario |");
    for (const scenarioId of ["bugfix", "feature-request", "refactor"]) {
      expect(result.stdout).toContain(`| ${scenarioId} |`);
    }
    expect(result.stdout).toContain("| n/a |");
    expect(result.stdout).not.toContain("Gate failed");
  });

  test("--gate fails when the current run is missing a baseline scenario", () => {
    const baseline = createRun({ name: "gate-base", kitVersion: "1.0.0", scenario: "all" });
    const current = createRun({ name: "gate-current", kitVersion: "1.1.0", scenario: "bugfix" });

    const result = runScript([
      "scripts/compare-runs.ts",
      "--baseline",
      toPortable(baseline),
      "--current",
      toPortable(current),
      "--gate",
    ]);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("feature-request: missing from the current run");
    expect(result.stderr).toContain("refactor: missing from the current run");
  });

  test("rejects a directory that is not a run directory", () => {
    const baseline = createRun({ name: "invalid-base", kitVersion: "1.0.0", scenario: "bugfix" });
    const empty = join(scratchRoot, "empty");
    rmSync(empty, { recursive: true, force: true });

    const result = runScript([
      "scripts/compare-runs.ts",
      "--baseline",
      toPortable(baseline),
      "--current",
      toPortable(join(scratchRoot, "not-a-run")),
    ]);
    expect(result.code).not.toBe(0);
    expect(result.stderr.length).toBeGreaterThan(0);
  });
});
