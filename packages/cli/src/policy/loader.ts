import { readFileSync, existsSync } from "fs";
import { parse } from "yaml";
import { PolicyConfigSchema, type PolicyConfig } from "@ankercode/core";

export function loadPolicy(policyPath: string): PolicyConfig {
  if (!existsSync(policyPath)) {
    throw new Error(`Policy-Datei nicht gefunden: ${policyPath}`);
  }

  let raw: unknown;
  try {
    raw = parse(readFileSync(policyPath, "utf8"));
  } catch (err) {
    throw new Error(`Fehler beim Lesen der Policy: ${(err as Error).message}`);
  }

  const result = PolicyConfigSchema.safeParse(raw ?? {});
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join(".")} — ${i.message}`)
      .join("\n");
    throw new Error(`ankercode.policy.yaml hat ungültige Einträge:\n${issues}`);
  }

  return result.data;
}
