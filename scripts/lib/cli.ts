// Shared command-line parsing for every script in scripts/.
// Only long options are accepted (`--name value` or `--name=value`) so that the
// workflows, the documentation and the tests invoke the scripts identically.

export type Args = Readonly<Record<string, string>>;

export class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UsageError";
  }
}

const BOOLEAN_FLAGS: ReadonlySet<string> = new Set(["dry-run", "gate", "help"]);

export function parseArgs(argv: readonly string[]): Args {
  const args: Record<string, string> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index] ?? "";
    if (!token.startsWith("--")) {
      throw new UsageError(`unexpected argument "${token}": options must start with "--"`);
    }
    const body = token.slice(2);
    if (body.length === 0) {
      throw new UsageError("empty option name");
    }
    const separator = body.indexOf("=");
    if (separator !== -1) {
      args[body.slice(0, separator)] = body.slice(separator + 1);
      continue;
    }
    if (BOOLEAN_FLAGS.has(body)) {
      args[body] = "true";
      continue;
    }
    const value = argv[index + 1];
    if (value === undefined) {
      throw new UsageError(`option "--${body}" requires a value`);
    }
    args[body] = value;
    index += 1;
  }
  return args;
}

export function requireOption(args: Args, name: string): string {
  const value = args[name];
  if (value === undefined || value.trim().length === 0) {
    throw new UsageError(`missing required option "--${name}"`);
  }
  return value.trim();
}

export function optionalOption(args: Args, name: string, fallback: string): string {
  const value = args[name];
  if (value === undefined || value.trim().length === 0) {
    return fallback;
  }
  return value.trim();
}

export function flagEnabled(args: Args, name: string): boolean {
  return args[name] === "true";
}

// Runs a script entry point: usage errors exit with 2, successful runs with the
// code returned by the callback. Nothing is printed to stdout that the caller
// did not print itself.
export function runCli(usage: string, run: (args: Args) => number): void {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (flagEnabled(args, "help")) {
      process.stdout.write(`${usage}\n`);
      return;
    }
    process.exitCode = run(args);
  } catch (error) {
    if (error instanceof UsageError) {
      process.stderr.write(`${error.message}\n\n${usage}\n`);
      process.exitCode = 2;
      return;
    }
    throw error;
  }
}
