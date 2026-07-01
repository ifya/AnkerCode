import type {
  Finding,
  PolicyConfig,
  PolicyResult,
  PolicyViolation,
} from "@ankercode/core";
import type { Decisions } from "@ankercode/report";

type RuleMatch = {
  ruleId:  string;
  action:  "block" | "warn" | "ignore";
  message: string;
};

// ── Vulnerability ─────────────────────────────────────────────────────────────
// Rules are evaluated top-to-bottom. First match wins.
// maxUnfixedDays is validated in schema but not yet enforced — CVE publish dates
// are not yet available in the Finding model. Add when CVE metadata is enriched.

function matchVuln(finding: Finding, policy: PolicyConfig): RuleMatch | null {
  for (const rule of policy.vulnerabilities) {
    if (!rule.severity.includes(finding.severity)) continue;
    if (rule.scope && !rule.scope.includes(finding.scope)) continue;

    const pkg   = finding.package?.name    ?? finding.id.slice(0, 8);
    const ver   = finding.package?.version ?? "";
    const cve   = finding.cveId            ?? finding.id.slice(0, 12);
    const fix   = finding.recommendedAction ? ` → ${finding.recommendedAction}` : " → kein Fix verfügbar";
    const scope = finding.scope !== "unknown" ? ` [${finding.scope}]` : "";

    return {
      ruleId:  rule.id,
      action:  rule.action,
      message: `${cve} in ${pkg}${ver ? `@${ver}` : ""}${fix}${scope}`,
    };
  }
  return null;
}

// ── License ───────────────────────────────────────────────────────────────────

function matchLicense(finding: Finding, policy: PolicyConfig): RuleMatch | null {
  const lp = policy.licenses;
  if (!lp) return null;
  if (lp.scope && finding.scope !== lp.scope) return null;

  const lic = finding.license ?? "unknown";
  const pkg = finding.package?.name ?? "unknown";

  if (lp.deny.includes(lic)) {
    return {
      ruleId:  "license-deny",
      action:  "block",
      message: `Lizenz ${lic} in ${pkg} ist nicht erlaubt (deny-Liste)`,
    };
  }
  if (lp.warn.includes(lic)) {
    return {
      ruleId:  "license-warn",
      action:  "warn",
      message: `Lizenz ${lic} in ${pkg} erfordert rechtliche Prüfung`,
    };
  }
  return null;
}

// ── Secret ────────────────────────────────────────────────────────────────────

function matchSecret(finding: Finding, policy: PolicyConfig): RuleMatch | null {
  const action = policy.secrets?.action ?? "block";
  if (action === "ignore") return null;
  const type = finding.source.ruleId ?? "secret";
  const loc  = finding.source.manifest
    ? (() => {
        const parts = finding.source.manifest.replace(/\\/g, "/").split("/");
        return parts.length > 3 ? `…/${parts.slice(-3).join("/")}` : finding.source.manifest;
      })()
    : finding.id.slice(0, 12);
  return {
    ruleId:  "secret-detected",
    action,
    message: `${type} in ${loc}`,
  };
}

// ── Main evaluator ────────────────────────────────────────────────────────────

export function evaluatePolicy(
  findings:   Finding[],
  policy:     PolicyConfig,
  decisions:  Decisions,
  policyFile: string,
): PolicyResult {
  const acceptedIds = new Set(
    (decisions.riskAcceptances ?? []).map((r) => r.findingId),
  );
  const vexMap = new Map(
    (decisions.vex ?? []).map((v) => [v.findingId, v]),
  );

  const violations: PolicyViolation[] = [];
  const warnings:   PolicyViolation[] = [];

  for (const finding of findings) {
    // Skip findings already handled by human decisions
    const vex = vexMap.get(finding.id);
    if (vex?.status === "not_affected" || vex?.status === "fixed") continue;
    if (acceptedIds.has(finding.id)) continue;

    let match: RuleMatch | null = null;
    if (finding.type === "vulnerability") match = matchVuln(finding, policy);
    else if (finding.type === "license")  match = matchLicense(finding, policy);
    else if (finding.type === "secret")   match = matchSecret(finding, policy);

    if (!match || match.action === "ignore") continue;

    const entry: PolicyViolation = {
      ruleId:    match.ruleId,
      findingId: finding.id,
      action:    match.action,
      message:   match.message,
    };

    if (match.action === "block") violations.push(entry);
    else                          warnings.push(entry);
  }

  return {
    passed:      violations.length === 0,
    violations,
    warnings,
    policyFile,
    evaluatedAt: new Date().toISOString(),
  };
}
