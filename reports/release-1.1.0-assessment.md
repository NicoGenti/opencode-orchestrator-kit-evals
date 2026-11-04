# Release assessment — opencode-orchestrator-kit 1.1.0

- Data: 2026-11-04
- Kit: `E:\MyProjects\opencode-orchestrator-kit`, ref `main`, commit `ea5968e58a72f63031e863432b0859a8556cfad6`
- Versione candidata: `1.1.0` (decisione D1: opzione A)
- Versione pubblicata di riferimento: `1.0.0` (tag `v1.0.0`, commit `9bc59b4e725278d2e45de01fb796a441cb5f6417`)
- Suite: `opencode-orchestrator-kit-evals` commit `728ad6a`, runner mode `dry-run`
- Baseline run: `runs/1.0.0/2026-11-04-default`
- Candidata run: `runs/1.1.0/2026-11-04-default`
- Toolchain: bun `1.3.14` (evals), `bun install --frozen-lockfile` eseguito in entrambi i repo

## Gate

| id | gate | comando | atteso | rilevato | esito |
| --- | --- | --- | --- | --- | --- |
| E1a | suite evals: typecheck | `bun run typecheck` | exit 0 | exit 0, nessun diagnostico | PASS |
| E1b | suite evals: lint | `bun run lint` | exit 0 | exit 0, nessun diagnostico | PASS |
| E1c | suite evals: test | `bun test` | exit 0 | exit 0, 22 pass, 0 fail, 123 `expect()`, 4.96 s | PASS |
| E2 | baseline `1.0.0` valida | `bun scripts/validate-run.ts --run-dir runs/1.0.0/2026-11-04-default` | `OK … (3 scenarios, mode dry-run)` | dopo la run: exit 0, `OK runs/1.0.0/2026-11-04-default (3 scenarios, mode dry-run)`; prima della run: exit 1, `run directory "…" does not exist` | PASS |
| E3 | candidata `1.1.0` valida | `bun scripts/validate-run.ts --run-dir runs/1.1.0/2026-11-04-default` | `OK … (3 scenarios, mode dry-run)` | dopo la run: exit 0, `OK runs/1.1.0/2026-11-04-default (3 scenarios, mode dry-run)`; prima: exit 1 | PASS |
| E3b | sha registrato | `node -p "require('./runs/1.1.0/2026-11-04-default/suite.json').kitCommit"` | sha di HEAD | `ea5968e58a72f63031e863432b0859a8556cfad6` | PASS |
| E4 | parità strutturale | `bun scripts/compare-runs.ts --baseline runs/1.0.0/2026-11-04-default --current runs/1.1.0/2026-11-04-default --gate` | `Gate passed.`, 3/3 scenari | exit 0, 3 righe (`bugfix`, `feature-request`, `refactor`), tutte `dry-run → dry-run`, ogni cella numerica `n/a`, ultima riga `Gate passed.` | PASS |
| E5 | nessuna metrica inventata | `grep -o "not measured" reports/2026-11-04-1.1.0-default.md \| wc -l` | 42 | 42; celle numeriche (`\| [0-9]+ \|`): 0; riga `mode \| dry-run`: 1 | PASS |
| K0 | inventario test locale | `bun test` (pre-bump) | nessuna voce non ambientale | 1087 pass, **25 fail**, 5409 `expect()`, 1112 test in 60 file, 76.93 s; 25 voci distinte, tutte nelle famiglie ambientali (dettaglio sotto) | PASS |
| K1 | typecheck | `bun run typecheck` | exit 0 | exit 0 (dopo `bun install --frozen-lockfile`) | PASS |
| K2 | lint | `bun run lint` | exit 0 | exit 0, nessun diagnostico | PASS |
| K3 | format | `bun run format:check` | exit 0 | worktree Windows: exit 1 su 114 file (CRLF vs `endOfLine: "lf"`); clone con `core.autocrlf=false` + prettier `3.3.3` del lockfile: exit 0, `All matched files use Prettier code style!` | PASS (misurato sul contenuto che la CI verifica) |
| K4 | asset sincronizzati | `bun run sync-assets --check` | `plugin/assets matches 32 source files.` | exit 0, `plugin/assets matches 32 source files.` | PASS |
| K5 | build docs | `bun run build` | exit 0 + `site/index.html` | exit 0, `✓ built in 5.61s`, `prepare-pages: wrote site\index.html, site\404.html (noindex), and site\sitemap.xml`, `site/index.html` 48.419 byte | PASS |

Valori ammessi: `PASS`, `FAIL`, `UNVERIFIED`. Nessun gate è `UNVERIFIED`.

### K0 — classificazione delle 25 voci di fail (tutte ambientali su Windows)

Nessuna voce resta senza famiglia: la release non introduce e non eredita fail di codice.

| famiglia | voci | causale rilevata |
| --- | --- | --- |
| `detect-os.sh` | 4 | `bash: line N: /mnt/e/MyProjects/opencode-orchestrator-kit/scripts/detect-os.sh: No such file or directory` (path MSYS non tradotto), exit 127 |
| `install.sh` (examples/upgrade/extras, OS gate, global tier tokens) | 10 | `Expected: 0 \| Received: null` / `Received: 127`: lo script non è eseguibile nell'ambiente del test |
| `validate-models.sh` | 8 | `Received: 127` oppure stdout vuoto (`""`) |
| `install-freellmapi.sh` | 1 | il preset letto è `'freellmapi'\r`: CRLF nel valore |
| `package versions match … changelog` | 1 | `changelog.startsWith("# Changelog\n")` → `false`: il file nel worktree è CRLF |
| `site head tokens … index.docs.html` | 1 | `toContain` fallisce sul sorgente CRLF (`\r\n`) |

### Nota sull'ambiente di misura

`node_modules` del kit installava `prettier@3.9.10` contro il lockfile `3.3.3`: drift locale, non un
problema del repository. `bun install --frozen-lockfile` ha ripristinato `3.3.3` e K1/K2/K3 sono stati
ri-misurati dopo il ripristino. Il worktree Windows usa `core.autocrlf=true`, quindi
`bun run format:check` fallisce localmente su qualunque file: il gate K3 è stato quindi misurato su un
clone con `core.autocrlf=false` (stesso contenuto che la CI su `ubuntu-latest` verifica) con il
prettier del lockfile. La conferma definitiva è il workflow `Test` in R8.

## Cosa questa valutazione NON prova

La suite è `dry-run`: nessun modello è stato invocato, nessun token misurato, nessun punteggio
assegnato. Di conseguenza questa release non ha **alcuna** evidenza su:

- qualità degli output degli agenti (task completion, correttezza, routing, aderenza ai vincoli, efficienza);
- token e costo per scenario (`baselines/*.json` sono vuote e non applicate da alcuno script);
- sicurezza comportamentale (`safety` non è stata valutata);
- rispetto delle `expected-constraints.json`, che sono dati dichiarati e non eseguiti
  (`fixtureStatus: placeholder`, nessuna directory `fixtures/`).

Le uniche prove deterministiche di questa release sono i gate K1–K5 (suite del kit, parity asset,
build) e il contenuto del tarball npm verificato dopo il bump. `Gate passed.` in E4 significa solo che
gli artefatti della candidata hanno la stessa forma della baseline: 3 scenari presenti, 3 validi, zero
valori numerici. Non significa "stessa qualità", non significa "stessi token", non significa
"nessuna regressione di comportamento".

## Evidenze

E2/E3, ciclo RED→GREEN sul validatore:

```
$ bun scripts/validate-run.ts --run-dir runs/1.1.0/2026-11-04-default
run directory "runs/1.1.0/2026-11-04-default" does not exist
exit=1
$ DRY_RUN=1 bun scripts/run-suite.ts --kit-version 1.1.0 --kit-ref main --kit-commit ea5968e… --model-profile default --scenario all
suite=0    wrote=16    RUN_DIR=runs/1.1.0/2026-11-04-default
$ bun scripts/validate-run.ts --run-dir runs/1.1.0/2026-11-04-default
OK runs/1.1.0/2026-11-04-default (3 scenarios, mode dry-run)
exit=0
```

E4, confronto con gate:

```
| scenario | baseline mode | current mode | baseline tokens | current tokens | delta tokens | baseline score | current score | delta score |
| bugfix | dry-run | dry-run | n/a | n/a | n/a | n/a | n/a | n/a |
| feature-request | dry-run | dry-run | n/a | n/a | n/a | n/a | n/a | n/a |
| refactor | dry-run | dry-run | n/a | n/a | n/a | n/a | n/a | n/a |

Gate passed.
exit=0
```

E5, rapporto del report `1.1.0`:

```
not_measured=42
numeric_cells=0
dryrun_line=1
```

K0, coda della suite del kit:

```
 1087 pass
 25 fail
 5409 expect() calls
Ran 1112 tests across 60 files. [76.93s]
```

K1–K5:

```
typecheck=0
lint=0
assets=0   plugin/assets matches 32 source files.
build=0    ✓ built in 5.61s / prepare-pages: wrote site\index.html, site\404.html (noindex), and site\sitemap.xml
format (worktree, autocrlf=true)=1 — 114 file
format (clone core.autocrlf=false, prettier 3.3.3)=0 — All matched files use Prettier code style!
```

## Decisione

DECISION: RELEASABLE

Motivazione, in una riga: il candidato `ea5968e` ha gli stessi tre scenari della baseline con
artefatti validi e zero metriche inventate, e passa tutti i gate deterministici del kit; la suite non
ha prodotto alcuna misura di qualità, quindi questa decisione **non** si appoggia a metriche di
qualità e va letta con la sezione "Cosa questa valutazione NON prova".

Aggiornamento previsto prima del tag: gate K6 (contenuto del tarball dopo il bump) e K3-CI (workflow
`Test` su `ubuntu-latest`).
