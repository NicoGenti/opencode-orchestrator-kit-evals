// JSON Schema validation of the generated run artifacts.
// Schemas live in schemas/ and are the single source of truth for artifact
// shape; this module only compiles and caches them.

import Ajv, { type ValidateFunction } from "ajv";
import { join } from "node:path";
import { SCHEMAS_DIR, readJsonFile } from "./run.ts";

export type SchemaName = "metadata" | "token-usage" | "quality-scores";

const ajv = new Ajv({ allErrors: true, strict: true });

const validators = new Map<SchemaName, ValidateFunction>();

function compile(schemaName: SchemaName): ValidateFunction {
  const schemaPath = join(SCHEMAS_DIR, `${schemaName}.schema.json`);
  return ajv.compile(readJsonFile<Record<string, unknown>>(schemaPath));
}

export function validateArtifact(schemaName: SchemaName, value: unknown): readonly string[] {
  const cached = validators.get(schemaName);
  const validate = cached ?? compile(schemaName);
  if (!cached) {
    validators.set(schemaName, validate);
  }
  if (validate(value)) {
    return [];
  }
  return (validate.errors ?? []).map(
    (error) => `${error.instancePath.length > 0 ? error.instancePath : "/"} ${error.message ?? "is invalid"}`,
  );
}
