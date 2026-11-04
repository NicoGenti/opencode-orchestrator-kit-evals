import { afterAll, describe, expect, test } from "bun:test";
import { cpSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BASE_ARGS, expectRunDir, makeScratchDir, runScript, toPortable } from "./helpers.ts";

const scratchRoot = makeScratchDir("evals-validate-");

afterAll(() => {
  rmSync(scratchRoot, { recursive: true, force: true });
});

function createRun(name: string): string {
  const outputDir = toPortable(join(scratchRoot, name));
  const result = runScript([...BASE_ARGS, "--scenario", "bugfix", "--output-dir", outputDir, "--dry-run"]);
  expect(result.code).toBe(0);
  return expectRunDir(result);
}

function copyRun(source: string, name: string): string {
  const target = join(scratchRoot, name);
  cpSync(source, target, { recursive: true });
  return target;
}

function tamperJson(path: string, mutate: (value: Record<string, unknown>) => void): void {
  const value = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  mutate(value);
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

describe("validate-run", () => {
  test("accepts a freshly generated dry run", () => {
    const runDir = createRun("valid");
    const result = runScript(["scripts/validate-run.ts", "--run-dir", toPortable(runDir)]);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("OK ");
    expect(result.stdout).toContain("(1 scenarios, mode dry-run)");
  });

  test("rejects a dry-run artifact that reports token counts", () => {
    const runDir = copyRun(createRun("tamper-tokens"), "tamper-tokens-copy");
    tamperJson(join(runDir, "bugfix", "token-usage.json"), (value) => {
      value.totalTokens = 42;
    });

    const result = runScript(["scripts/validate-run.ts", "--run-dir", toPortable(runDir)]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("FAILED ");
    expect(result.stderr).toContain("token-usage.json");
    expect(result.stderr).toContain("totalTokens");
  });

  test("rejects a missing transcript", () => {
    const runDir = copyRun(createRun("missing-transcript"), "missing-transcript-copy");
    rmSync(join(runDir, "bugfix", "transcript.md"));

    const result = runScript(["scripts/validate-run.ts", "--run-dir", toPortable(runDir)]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("bugfix/transcript.md: missing");
  });

  test("rejects artifacts whose modes disagree", () => {
    const runDir = copyRun(createRun("mode-mismatch"), "mode-mismatch-copy");
    tamperJson(join(runDir, "bugfix", "metadata.json"), (value) => {
      value.mode = "live";
      value.status = "passed";
    });

    const result = runScript(["scripts/validate-run.ts", "--run-dir", toPortable(runDir)]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("differs from metadata mode");
  });

  test("rejects metadata that does not match suite.json", () => {
    const runDir = copyRun(createRun("suite-mismatch"), "suite-mismatch-copy");
    tamperJson(join(runDir, "bugfix", "metadata.json"), (value) => {
      value.kitVersion = "9.9.9";
    });

    const result = runScript(["scripts/validate-run.ts", "--run-dir", toPortable(runDir)]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('"kitVersion" differs from suite.json');
  });

  test("rejects a missing run directory", () => {
    const result = runScript(["scripts/validate-run.ts", "--run-dir", toPortable(join(scratchRoot, "absent"))]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("does not exist");
  });
});
