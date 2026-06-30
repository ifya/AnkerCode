import { readFileSync, existsSync } from "fs";
import { parse } from "yaml";
import { z } from "zod";
import { VexStatementSchema, RiskAcceptanceSchema } from "@ankercode/core";

const DecisionsFileSchema = z.object({
  vex: z.array(VexStatementSchema).nullish().transform((v) => v ?? []),
  riskAcceptances: z.array(RiskAcceptanceSchema).nullish().transform((v) => v ?? []),
});

export type Decisions = z.infer<typeof DecisionsFileSchema>;

export function loadDecisions(projectRoot: string): Decisions {
  const decisionsPath = `${projectRoot}/ankercode.decisions.yaml`;

  if (!existsSync(decisionsPath)) {
    return { vex: [], riskAcceptances: [] };
  }

  let raw: unknown;
  try {
    raw = parse(readFileSync(decisionsPath, "utf8"));
  } catch (err) {
    console.warn(`  Warnung: ankercode.decisions.yaml konnte nicht gelesen werden — ${(err as Error).message}`);
    return { vex: [], riskAcceptances: [] };
  }

  const result = DecisionsFileSchema.safeParse(raw ?? {});
  if (!result.success) {
    console.warn(`  Warnung: ankercode.decisions.yaml hat ungültige Einträge:`);
    for (const issue of result.error.issues) {
      console.warn(`    ${issue.path.join(".")} — ${issue.message}`);
    }
    return { vex: [], riskAcceptances: [] };
  }

  return result.data;
}

export const DECISIONS_TEMPLATE = `# AnkerCode — Triage-Entscheidungen
# Committen Sie diese Datei ins Repository. Sie macht Reports reproduzierbar.
# Dokumentation: https://github.com/nicholasstephan/openvex-spec

vex:
  # Beispiel: CVE als nicht betroffen markieren
  # - findingId: "abc123def456abcd"   # aus findings.json
  #   status: not_affected            # not_affected | affected | fixed | under_investigation
  #   justification: vulnerable_code_not_in_execute_path
  #   statement: "Die betroffene Funktion wird in unserem Deployment nicht aufgerufen."
  #   author: "Vorname Nachname"
  #   timestamp: "${new Date().toISOString()}"

riskAcceptances:
  # Beispiel: Risiko bewusst akzeptieren
  # - findingId: "def456abc789def0"
  #   reason: "Nur in der Entwicklungsumgebung, nicht in Produktion deployed."
  #   acceptedBy: "Vorname Nachname"
  #   expiresAt: "2027-01-01"
`;
