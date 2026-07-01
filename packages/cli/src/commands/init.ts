import { existsSync, writeFileSync } from "fs";
import { resolve, join } from "path";
import { DECISIONS_TEMPLATE } from "@ankercode/report";

export const POLICY_TEMPLATE = `# AnkerCode Policy — ankercode.policy.yaml
# Regeln werden von oben nach unten ausgewertet. Erste Übereinstimmung gewinnt.
# action: block  → Exit-Code 2 (bricht CI ab)
# action: warn   → Exit-Code 0 (erscheint im Report, bricht nicht ab)
# action: ignore → Regel deaktiviert

version: 1

vulnerabilities:
  - id: block-critical-production
    severity: [critical]
    scope: [production]
    action: block

  - id: block-high-production
    severity: [high]
    scope: [production]
    action: block

  - id: warn-medium-production
    severity: [medium]
    scope: [production]
    action: warn

  - id: warn-critical-dev
    severity: [critical, high]
    scope: [development, unknown]
    action: warn

licenses:
  deny:
    - GPL-2.0-only
    - GPL-3.0-only
    - AGPL-3.0-only
  warn:
    - LGPL-2.1-only
    - MPL-2.0
    - EUPL-1.2
  scope: production     # nur Produktionsabhängigkeiten prüfen

secrets:
  action: block         # Secrets blockieren immer
`;

export async function runInit(targetPath: string): Promise<void> {
  const target = resolve(targetPath);

  const decisionsPath = join(target, "ankercode.decisions.yaml");
  const policyPath    = join(target, "ankercode.policy.yaml");

  let created = false;

  if (!existsSync(decisionsPath)) {
    writeFileSync(decisionsPath, DECISIONS_TEMPLATE, "utf8");
    console.log(`\nErstellt: ${decisionsPath}`);
    created = true;
  } else {
    console.log(`Bereits vorhanden: ${decisionsPath}`);
  }

  if (!existsSync(policyPath)) {
    writeFileSync(policyPath, POLICY_TEMPLATE, "utf8");
    console.log(`Erstellt: ${policyPath}`);
    created = true;
  } else {
    console.log(`Bereits vorhanden: ${policyPath}`);
  }

  if (created) {
    console.log(
      "\nNächste Schritte:" +
      "\n  1. ankercode.policy.yaml anpassen — Regeln für Ihr Projekt definieren" +
      "\n  2. ankercode scan       — Scan ausführen" +
      "\n  3. ankercode policy check — Policy auswerten" +
      "\n  4. ankercode report     — Report mit Policy-Ergebnis generieren\n",
    );
  } else {
    console.log("\nNichts geändert.\n");
  }
}
