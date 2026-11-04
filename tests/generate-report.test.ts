import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { BASE_ARGS, expectRunDir, makeScratchDir, runScript, toPortable } from "./helpers.ts";

const scratchRoot = makeScratchDir("evals-report-");

afterAll(() => {
  rmSync(scratchRoot, { recursive: true, force: true });
});

describe("generate-report", () => {
  test("renders a report with a section per scenario and no invented numbers", () => {
    const outputDir = toPortable(join(scratchRoot, "runs"));
    const runDir = expectRunDir(runScript([...BASE_ARGS, "--output-dir", outputDir, "--dry-run"]));
    const outPath = join(scratchRoot, "report.md");

    const result = runScript([
      "scripts/generate-report.ts",
      "--run-dir",
      toPortable(runDir),
      "--out",
      toPortable(outPath),
    ]);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("wrote ");
    expect(existsSync(outPath)).toBe(true);

    const report = readFileSync(outPath, "utf8");
    expect(report).toContain("# Evaluation report: 1.0.0 / default");
    expect(report).toContain("DRY_RUN");
    expect(report).toContain("### bugfix");
    expect(report).toContain("### feature-request");
    expect(report).toContain("### refactor");
    expect(report).toContain("not measured");
    expect(report).not.toMatch(/\| total tokens \| \d+/);
    expect(report).not.toMatch(/\| total score \| \d+/);
  });
});
