# Evaluation methodology

## Purpose

This repository measures the behaviour of [opencode-orchestrator-kit](https://github.com/NicoGenti/opencode-orchestrator-kit)
instead of describing it. Every change to the kit (routing rules, subagent prompts,
model profiles) should be justifiable with a run: the same scenarios, executed the same
way, compared against a previous run.

The suite answers three separate questions. They are kept separate because they fail
for different reasons and are trusted differently:

| evaluation | question | data source | trust |
| --- | --- | --- | --- |
| regression | did the kit still produce the required files and respect the constraints? | deterministic assertions in `expected-constraints.json` | high: machine-checked |
| token budget | how many tokens and tool calls did the run cost? | provider usage reported per run | high: measured, not estimated |
| qualitative | how good was the result on task completion, correctness, routing, adherence, efficiency, safety? | judge scores 0-3 | medium: reproducible only with a fixed judge |

A run that improves the qualitative score while doubling the token count is not an
improvement; that is why the three dimensions are reported side by side and never
collapsed into one number.

## Run naming convention

```
runs/{kit-version}/{YYYY-MM-DD}-{model-profile}/{scenario-id}/
```

- `kit-version` is the label passed with `--kit-version` (a release tag such as `1.2.0`,
  or `nightly`).
- the date is the UTC date of execution, so two runs of the same day and profile
  intentionally overwrite each other: a run directory describes the last execution of
  that day, not a history of executions.
- `model-profile` is the label passed with `--model-profile` and must match the profile
  actually used by the kit.
- one subdirectory per scenario, because a run directory covers a scenario set.

Comparison always happens between two run directories, never between two files.

## Artifact contract

Each scenario directory holds exactly five artifacts:

| file | schema | notes |
| --- | --- | --- |
| `metadata.json` | `schemas/metadata.schema.json` | `kitVersion`, `kitRef`, `kitCommit`, `scenario`, `modelProfile`, `executedAt`, `runnerVersion`, `status`, `mode` |
| `token-usage.json` | `schemas/token-usage.schema.json` | `promptTokens`, `completionTokens`, `totalTokens`, `toolCallCount`, `durationSeconds`, `estimatedCostUsd` |
| `quality-scores.json` | `schemas/quality-scores.schema.json` | five dimensions scored 0-3, `safety` as `pass`/`fail`, `total`, `max` |
| `transcript.md` | none (non-empty text) | the agent output, or the explicit DRY_RUN statement |
| `tool-calls.jsonl` | none (one JSON object per line) | empty in DRY_RUN |

Rules that hold for every artifact:

1. `mode` is `dry-run` or `live`, and the same value appears in `metadata.json`,
   `token-usage.json`, `quality-scores.json` and `suite.json`.
2. In `dry-run`, every numeric metric is `null`. A dry run never invents a value, and
   `validate-run.ts` rejects a dry-run artifact that reports numbers.
3. In `live`, every numeric metric is a real measurement: `totalTokens` equals
   `promptTokens + completionTokens`, and `total` equals the sum of the five dimensions
   with `max = 15`.
4. `metadata.kitVersion`, `kitRef`, `kitCommit`, `modelProfile`, `executedAt` and
   `runnerVersion` must match `suite.json`, so a run is reproducible from its metadata
   alone.
5. `quality-scores.json` is only written by a judge; until a judge exists, the file is
   present with `null` values.

`bun scripts/validate-run.ts --run-dir <path>` enforces the contract: presence, JSON
syntax, JSON Schema, cross-field invariants and the cross-artifact consistency above.
It exits `0` when the run is valid and `1` when it is not, listing every problem.

## Baseline update policy

`baselines/token-budgets.json` and `baselines/quality-scores.json` are the reference
values used to decide whether a new kit version is acceptable.

- A baseline entry is created only from a real measured run. Hand-written estimates,
  rounded guesses and values copied from another machine are not baselines.
- Each entry records the value and the kit version that produced it; the run path goes
  in the pull request description.
- Baselines move in one direction by default: a token budget may only be raised with a
  justification in the pull request, and a quality score may only be lowered with the
  same justification.
- When the scenario set, the judge model or the scoring rubric changes, the baselines
  are invalidated and rebuilt: bump `version` and clear the affected entries.
- Both files start empty (`"scenarios": {}`) and stay empty until the first live run.
  No script enforces them in the current version; the comparison is done with
  `compare-runs.ts` between two run directories.

## Release gate policy

A kit release is evaluated with `evaluate-release.yml` (DRY_RUN until providers are
connected). The gate is applied to the produced run directory:

1. `bun scripts/validate-run.ts --run-dir <run>` must exit `0`. An invalid artifact set
   blocks the release: an unverifiable run is a failed run.
2. `bun scripts/compare-runs.ts --baseline <previous-run> --current <new-run> --gate`
   must exit `0`. It fails when a scenario is missing from the new run or when the
   quality total drops.
3. Once token budgets are populated, the gate also fails when a scenario exceeds its
   recorded budget. Until then the budget check is explicitly documented as missing,
   never approximated.

A run with `status` `failed` or `partial` never passes the gate, regardless of scores.

## How to compare two runs

```bash
bun scripts/compare-runs.ts --baseline runs/1.0.0/2026-11-01-default \
                            --current  runs/1.1.0/2026-11-04-default
```

The output is a Markdown table with one row per scenario and the columns
`baseline tokens`, `current tokens`, `delta tokens`, `baseline score`, `current score`,
`delta score`. `n/a` means the value was not measured in that run (for example any
DRY_RUN run), and `absent` means the scenario is missing from that run directory.

Interpretation rules:

- A positive token delta is a cost regression, even when the score also improves: report
  both before deciding.
- A negative score delta is a quality regression and fails `--gate`.
- A missing scenario is a coverage regression and fails `--gate`.
- Comparing a `dry-run` run with a `live` run is allowed but has no meaning for the
  metrics; only the artifact shape is comparable.
