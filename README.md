# opencode-orchestrator-kit-evals

Reproducible evaluation suite for [opencode-orchestrator-kit](https://github.com/NicoGenti/opencode-orchestrator-kit):
regression checks, token usage tracking and qualitative agent benchmarks.

The suite exists so that a change to the kit (a routing rule, a subagent prompt, a
model profile) can be measured instead of guessed: the same scenarios run against two
kit versions, and the difference is reported as data.

## Current state

The runner is **DRY_RUN only**. It generates the complete artifact contract with every
metric set to `null` from the scenario definitions, so the layout, the schemas, the
validation and the workflows can be verified before any model provider is connected.
No token count, cost, score or model output is invented anywhere in this repository.

## Repository structure

```
scenarios/        one directory per scenario: definition, instructions, deterministic constraints
baselines/        reference values per scenario (empty until a live run measures them)
runs/             generated run directories (committed only on purpose, never by CI)
reports/          generated Markdown reports
schemas/          JSON Schema contracts for metadata, token usage and quality scores
scripts/          runner, validator, comparator and report generator
tests/            Bun tests that drive the scripts exactly like the workflows do
.github/workflows evaluate-release.yml (manual) and nightly-evaluation.yml (cron)
```

## Prerequisites

- Bun 1.3.0 or newer (`bun --version`); the pinned toolchain is `bun@1.3.14`.
- Git.
- No API key, token or provider credential: DRY_RUN mode never calls a model.

## How to run an evaluation

```bash
bun install --frozen-lockfile
DRY_RUN=1 bun scripts/run-suite.ts \
  --kit-version 0.1.0 \
  --kit-ref main \
  --model-profile default \
  --scenario all
```

Options:

| option | required | default | meaning |
| --- | --- | --- | --- |
| `--kit-version` | yes | - | label of the kit version, first path segment of the run |
| `--kit-ref` | yes | - | git ref that was checked out |
| `--kit-commit` | no | `null` | resolved commit, recorded for reproducibility |
| `--scenario` | no | `all` | scenario id or `all` |
| `--model-profile` | yes | - | label of the model profile, second path segment of the run |
| `--output-dir` | no | `runs` | base directory for run directories |
| `--dry-run` | no | - | generate placeholder artifacts (also `DRY_RUN=1`) |

The runner prints one `wrote <path>` line per artifact and ends with a
`RUN_DIR=<path>` line; scripts and workflows parse that last line instead of
duplicating the naming convention.

Validate what was produced:

```bash
bun scripts/validate-run.ts --run-dir runs/0.1.0/2026-11-04-default
# OK runs/0.1.0/2026-11-04-default (3 scenarios, mode dry-run)
```

Render a Markdown report:

```bash
bun scripts/generate-report.ts --run-dir runs/0.1.0/2026-11-04-default
# wrote reports/2026-11-04-0.1.0-default.md
```

## How to compare runs

```bash
bun scripts/compare-runs.ts \
  --baseline runs/0.1.0/2026-11-04-default \
  --current  runs/0.2.0/2026-11-04-default
```

The command prints a Markdown table with one row per scenario: total tokens, quality
total and their deltas. A metric that was not measured is reported as `n/a` and is
never compared.

Add `--gate` to fail (exit code 1) when the current run is missing a scenario listed in
the baseline, or when the quality total drops below the baseline. See
[methodology.md](methodology.md) for the policy behind that gate.

## How to update baselines

`baselines/token-budgets.json` and `baselines/quality-scores.json` start empty on
purpose: they may only be filled from a real measured run, never by hand-estimating
values. To update:

1. Run the suite against the kit version you want to freeze.
2. Validate the run directory with `bun scripts/validate-run.ts`.
3. Copy the measured `totalTokens` (token budgets) or `total` (quality scores) per
   scenario into the matching baseline file.
4. Record the kit version and the run path in the pull request description.
5. Bump `version` when the shape or the meaning of the values changes.

No baseline entry is added in this repository yet, and no script enforces these files
in the current version.

## Artifact output

Every run directory follows `runs/{kit-version}/{YYYY-MM-DD}-{model-profile}/` and
contains `suite.json` plus one directory per executed scenario:

| artifact | content |
| --- | --- |
| `suite.json` | run-level summary: kit version, ref, commit, profile, mode, scenario list |
| `metadata.json` | `kitVersion`, `kitRef`, `kitCommit`, `scenario`, `modelProfile`, `executedAt`, `runnerVersion`, `status`, `mode` |
| `token-usage.json` | `promptTokens`, `completionTokens`, `totalTokens`, `toolCallCount`, `durationSeconds`, `estimatedCostUsd` |
| `quality-scores.json` | `taskCompletion`, `correctness`, `routing`, `constraintAdherence`, `efficiency` (0-3), `safety` (`pass`/`fail`), `total`, `max` (15) |
| `transcript.md` | what the agent produced, or the explicit DRY_RUN statement |
| `tool-calls.jsonl` | one JSON object per tool call; empty in DRY_RUN |

`metadata.json`, `token-usage.json` and `quality-scores.json` are validated against
`schemas/*.schema.json`. A `dry-run` artifact must keep every metric `null`: a dry run
that reports numbers fails validation.

## Repository workflows

- `evaluate-release.yml`: manual run (`workflow_dispatch`) with `kit_version`, `kit_ref`,
  `model_profile`, `scenario`. Typechecks, lints, runs DRY_RUN, validates the artifacts
  and uploads the run directory as a workflow artifact. It never commits artifacts.
- `nightly-evaluation.yml`: cron run of all three scenarios, same pipeline, and it opens
  or updates the issue "Nightly evaluation failed" when the job fails.

## Current limitations

- No model provider is connected: DRY_RUN produces `null` metrics only.
- Scenario fixtures (`fixtures/<scenario>`) do not exist yet; `scenario.json` carries
  `"fixtureStatus": "placeholder"` until they are added.
- The deterministic constraints in `expected-constraints.json` are declared and
  validated as data, but nothing executes them against an agent workspace yet.
- `baselines/*.json` are not enforced by any script yet.
- No LLM judge: quality scores stay `null` until a judge is integrated.

## Related

- [NicoGenti/opencode-orchestrator-kit](https://github.com/NicoGenti/opencode-orchestrator-kit) - the kit under evaluation.
