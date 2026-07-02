import type { ScanRun, Finding, PolicyResult } from "@ankercode/core";
import type { Decisions } from "./decisions.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

const SEV_RANK: Record<Finding["severity"], number> = {
  critical: 0, high: 1, medium: 2, low: 3, info: 4,
};

function severityLabel(s: Finding["severity"]): string {
  return { critical: "KRITISCH", high: "HOCH", medium: "MITTEL", low: "NIEDRIG", info: "INFO" }[s];
}

function severityDot(s: Finding["severity"]): string {
  const colors: Record<Finding["severity"], string> = {
    critical: "#dc2626", high: "#ea580c", medium: "#d97706", low: "#2563eb", info: "#9ca3af",
  };
  return `<span style="color:${colors[s]};font-size:1.1em">●</span>`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function escapeMarkdown(s: string): string {
  return s.replace(/[\\`*_{}[\]()#+\-.!|]/g, "\\$&");
}

function sortedFindings(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity]);
}

// ── Action-group builder ──────────────────────────────────────────────────────
// Groups policy-flagged findings by package@version for the Maßnahmenplan.

type ActionGroup = {
  packageName:  string;
  version:      string;
  cves:         string[];
  fixAction:    string;
  maxSeverity:  Finding["severity"];
  policyAction: "block" | "warn";
};

type SecretEntry = {
  message:      string;
  policyAction: "block" | "warn";
};

type ActionPlan = {
  secrets: SecretEntry[];
  upgrades: ActionGroup[];
};

function buildActionPlan(findings: Finding[], policyResult: PolicyResult): ActionPlan {
  const findingById = new Map(findings.map((f) => [f.id, f]));
  const pkgGroups   = new Map<string, ActionGroup>();
  const secrets: SecretEntry[] = [];

  for (const entry of [...policyResult.violations, ...policyResult.warnings]) {
    const f = findingById.get(entry.findingId);
    if (!f) continue;

    if (f.type === "secret") {
      secrets.push({ message: entry.message, policyAction: entry.action as "block" | "warn" });
      continue;
    }

    if (f.type !== "vulnerability") continue;

    const pkgName = f.package?.name    ?? "unknown";
    const pkgVer  = f.package?.version ?? "?";
    const key     = `${pkgName}@${pkgVer}`;
    const cve     = f.cveId ?? null;

    const existing = pkgGroups.get(key);
    if (existing) {
      if (cve && !existing.cves.includes(cve)) existing.cves.push(cve);
      if (entry.action === "block") existing.policyAction = "block";
      if (SEV_RANK[f.severity] < SEV_RANK[existing.maxSeverity]) {
        existing.maxSeverity = f.severity;
        // Use the fix recommendation from the most severe CVE
        if (f.recommendedAction) existing.fixAction = f.recommendedAction;
      }
    } else {
      pkgGroups.set(key, {
        packageName:  pkgName,
        version:      pkgVer,
        cves:         cve ? [cve] : [],
        fixAction:    f.recommendedAction ?? "kein Fix verfügbar",
        maxSeverity:  f.severity,
        policyAction: entry.action as "block" | "warn",
      });
    }
  }

  // Sort: blocks first, then by severity, then alphabetically
  const upgrades = [...pkgGroups.values()].sort((a, b) => {
    if (a.policyAction !== b.policyAction) return a.policyAction === "block" ? -1 : 1;
    const sevDiff = SEV_RANK[a.maxSeverity] - SEV_RANK[b.maxSeverity];
    if (sevDiff !== 0) return sevDiff;
    return a.packageName.localeCompare(b.packageName);
  });

  return { secrets, upgrades };
}

// ── Main render ───────────────────────────────────────────────────────────────

export function renderReportMarkdown(
  scanRun:       ScanRun,
  decisions:     Decisions,
  policyResult?: PolicyResult,
): string {
  const vulnFindings    = sortedFindings(scanRun.findings.filter((f) => f.type === "vulnerability"));
  const licenseFindings = scanRun.findings.filter((f) => f.type === "license");
  const secretFindings  = scanRun.findings.filter((f) => f.type === "secret");

  const acceptedIds = new Set((decisions.riskAcceptances ?? []).map((r) => r.findingId));
  const vexMap      = new Map((decisions.vex ?? []).map((v) => [v.findingId, v]));

  const openVulns = vulnFindings.filter(
    (f) => !acceptedIds.has(f.id) && vexMap.get(f.id)?.status !== "not_affected",
  );
  const critHigh = openVulns.filter((f) => f.severity === "critical" || f.severity === "high");

  let sec = 0;
  const S = () => `${++sec}.`;

  const lines: string[] = [];

  // ── Header ────────────────────────────────────────────────────────────────
  lines.push(`% CRA Readiness Evidence Report`);
  lines.push(`% ${escapeMarkdown(scanRun.project)}`);
  lines.push(`% ${formatDate(scanRun.createdAt)}`);
  lines.push("");

  // ── 1. Zusammenfassung ────────────────────────────────────────────────────
  lines.push(`# ${S()} Zusammenfassung`);
  lines.push("");
  lines.push(
    `Dieser Bericht dokumentiert den Sicherheits- und Lizenz-Status des Projekts ` +
    `**${escapeMarkdown(scanRun.project)}** auf Basis automatisierter lokaler Scans. ` +
    `Er dient als Nachweis im Rahmen der technischen Unterstützung für Compliance-Prozesse ` +
    `gemäß CRA Readiness und BSI TR-03183.`,
  );
  lines.push("");
  lines.push("| Kennzahl | Wert |");
  lines.push("|---|---|");
  lines.push(`| Scan-Datum | ${formatDate(scanRun.createdAt)} |`);
  if (scanRun.branch)    lines.push(`| Branch | \`${escapeMarkdown(scanRun.branch)}\` |`);
  if (scanRun.commitSha) lines.push(`| Commit | \`${escapeMarkdown(scanRun.commitSha.slice(0, 12))}\` |`);
  lines.push(`| Schwachstellen (gesamt) | ${vulnFindings.length} |`);
  lines.push(`| Kritisch/Hoch (offen) | ${critHigh.length} |`);
  lines.push(`| Secrets-Treffer | ${secretFindings.length} |`);
  lines.push(`| Lizenzen erfasst | ${licenseFindings.length} |`);
  lines.push(`| Akzeptierte Risiken | ${decisions.riskAcceptances?.length ?? 0} |`);
  if (policyResult) {
    const st = policyResult.passed ? "✓ BESTANDEN" : `✗ NICHT BESTANDEN (${policyResult.violations.length} Verstoß/Verstöße)`;
    lines.push(`| Policy-Status | ${st} |`);
    if (policyResult.warnings.length > 0) lines.push(`| Policy-Warnungen | ${policyResult.warnings.length} |`);
  }
  lines.push("");

  // ── 2. Policy-Bewertung ───────────────────────────────────────────────────
  if (policyResult) {
    lines.push(`# ${S()} Policy-Bewertung`);
    lines.push("");

    const icon   = policyResult.passed ? "✓" : "✗";
    const status = policyResult.passed ? "BESTANDEN" : "NICHT BESTANDEN";
    lines.push(`**${icon} ${status}**`);
    lines.push("");

    if (policyResult.violations.length === 0 && policyResult.warnings.length === 0) {
      lines.push("*Alle Regeln eingehalten. Keine Verstöße oder Warnungen.*");
    } else {
      // Show only blockers here — warnings go in Maßnahmenplan
      if (policyResult.violations.length > 0) {
        lines.push(`**${policyResult.violations.length} blockierende Verstoß/Verstöße — CI-Gate aktiv:**`);
        lines.push("");
        lines.push("| Regel | Befund |");
        lines.push("|---|---|");
        for (const v of policyResult.violations) {
          lines.push(`| \`${escapeMarkdown(v.ruleId)}\` | ${escapeMarkdown(v.message)} |`);
        }
        lines.push("");
      } else {
        lines.push("*Keine blockierenden Verstöße.*");
        lines.push("");
      }
      if (policyResult.warnings.length > 0) {
        lines.push(
          `> **${policyResult.warnings.length} Warnungen** (nicht blockierend) — ` +
          `priorisierte Maßnahmen siehe Abschnitt Maßnahmenplan.`,
        );
        lines.push("");
      }
    }
    lines.push(`> Grundlage: \`${escapeMarkdown(policyResult.policyFile)}\` — Ausgewertet: ${formatDate(policyResult.evaluatedAt)}`);
    lines.push("");
  }

  // ── 3. Maßnahmenplan ──────────────────────────────────────────────────────
  if (policyResult && (policyResult.violations.length > 0 || policyResult.warnings.length > 0)) {
    const plan = buildActionPlan(scanRun.findings, policyResult);
    lines.push(`# ${S()} Maßnahmenplan`);
    lines.push("");
    lines.push(
      "Priorisierte Handlungsempfehlungen. Jede Zeile entspricht einem konkreten Schritt — " +
      "blockierende Verstöße zuerst, dann Warnungen. Vollständige CVE-Details in Abschnitt Schwachstellen.",
    );
    lines.push("");

    // Secrets block
    if (plan.secrets.length > 0) {
      lines.push("## Secrets rotieren");
      lines.push("");
      lines.push("| Priorität | Secret |");
      lines.push("|---|---|");
      for (const s of plan.secrets) {
        const prio = s.policyAction === "block" ? "**🔴 SOFORT**" : "🟡 Warnung";
        lines.push(`| ${prio} | ${escapeMarkdown(s.message)} |`);
      }
      lines.push("");
    }

    // Package upgrades block
    if (plan.upgrades.length > 0) {
      const blockCount = plan.upgrades.filter((u) => u.policyAction === "block").length;
      const warnCount  = plan.upgrades.filter((u) => u.policyAction === "warn").length;
      lines.push(`## Paket-Upgrades (${blockCount} blockierend · ${warnCount} Warnungen)`);
      lines.push("");
      lines.push("| Prio | Paket | Aktuell | Upgrade auf | CVEs | Schwere |");
      lines.push("|---|---|---|---|---|---|");
      for (const g of plan.upgrades) {
        const prio   = g.policyAction === "block" ? "**🔴**" : "🟡";
        const cveCnt = g.cves.length > 0 ? String(g.cves.length) : "—";
        lines.push(
          `| ${prio} ` +
          `| \`${escapeMarkdown(g.packageName)}\` ` +
          `| ${escapeMarkdown(g.version)} ` +
          `| ${escapeMarkdown(g.fixAction)} ` +
          `| ${cveCnt} ` +
          `| ${severityLabel(g.maxSeverity)} |`,
        );
      }
      lines.push("");
    }
  }

  // ── SBOM-Zusammenfassung ──────────────────────────────────────────────────
  lines.push(`# ${S()} SBOM-Zusammenfassung`);
  lines.push("");
  if (scanRun.sbomRef) {
    lines.push(
      `Eine Software Bill of Materials (SBOM) im Format **${scanRun.sbomRef.format}** ` +
      `wurde erstellt und lokal gespeichert.`,
    );
    lines.push("");
    lines.push("| Attribut | Wert |");
    lines.push("|---|---|");
    lines.push(`| Format | ${scanRun.sbomRef.format} |`);
    lines.push(`| SHA-256 | \`${escapeMarkdown(scanRun.sbomRef.hash.slice(0, 16))}…\` |`);
    lines.push(`| Pfad | \`${escapeMarkdown(scanRun.sbomRef.path)}\` |`);
  } else {
    lines.push("*Kein SBOM in diesem Scan-Lauf erzeugt.*");
  }
  lines.push("");

  // ── Schwachstellen ────────────────────────────────────────────────────────
  lines.push(`# ${S()} Schwachstellen`);
  lines.push("");
  if (openVulns.length === 0) {
    lines.push("*Keine offenen Schwachstellen gefunden.*");
  } else {
    const bySeverity: Array<[Finding["severity"], string]> = [
      ["critical", "Kritisch"], ["high", "Hoch"], ["medium", "Mittel"], ["low", "Niedrig"], ["info", "Info"],
    ];
    for (const [sev, label] of bySeverity) {
      const group = openVulns.filter((f) => f.severity === sev);
      if (group.length === 0) continue;
      lines.push(`## ${severityDot(sev)} ${label} (${group.length})`);
      lines.push("");
      lines.push("| CVE / ID | Paket | Version | Fix | Manifest |");
      lines.push("|---|---|---|---|---|");
      for (const f of group) {
        lines.push(
          `| ${escapeMarkdown(f.cveId ?? f.id)} ` +
          `| \`${escapeMarkdown(f.package?.name ?? "—")}\` ` +
          `| ${escapeMarkdown(f.package?.version ?? "—")} ` +
          `| ${f.fixAvailable ? `✓ ${escapeMarkdown(f.recommendedAction ?? "")}` : "—"} ` +
          `| ${escapeMarkdown(f.source.manifest ?? f.source.scanner)} |`,
        );
      }
      lines.push("");
    }
  }

  // ── Secrets ───────────────────────────────────────────────────────────────
  if (secretFindings.length > 0) {
    lines.push(`# ${S()} Secrets / Leaked Credentials`);
    lines.push("");
    lines.push("| Schwere | Typ | Fundort | Status |");
    lines.push("|---|---|---|---|");
    for (const f of secretFindings) {
      const loc = f.source.manifest
        ? (() => {
            const parts = f.source.manifest.replace(/\\/g, "/").split("/");
            return parts.length > 3 ? `…/${parts.slice(-3).join("/")}` : f.source.manifest;
          })()
        : "—";
      lines.push(
        `| ${severityLabel(f.severity)} ` +
        `| ${escapeMarkdown(f.source.ruleId ?? "secret")} ` +
        `| \`${escapeMarkdown(loc)}\` ` +
        `| ${escapeMarkdown(f.status)} |`,
      );
    }
    lines.push("");
  }

  // ── Lizenz-Risiko ─────────────────────────────────────────────────────────
  lines.push(`# ${S()} Lizenz-Risiko`);
  lines.push("");
  if (licenseFindings.length === 0) {
    lines.push("*Keine Lizenzen erfasst.*");
  } else {
    const byLicense = new Map<string, string[]>();
    for (const f of licenseFindings) {
      const lic      = f.license ?? "unbekannt";
      const existing = byLicense.get(lic) ?? [];
      if (f.package?.name && !existing.includes(f.package.name)) existing.push(f.package.name);
      byLicense.set(lic, existing);
    }
    const sorted = [...byLicense.entries()].sort((a, b) => b[1].length - a[1].length);
    lines.push("| Lizenz | Anzahl Pakete |");
    lines.push("|---|---|");
    for (const [lic, pkgs] of sorted) lines.push(`| ${escapeMarkdown(lic)} | ${pkgs.length} |`);
    lines.push("");
    for (const [lic, pkgs] of sorted) {
      lines.push(`**${escapeMarkdown(lic)}**`);
      lines.push("");
      const chunks: string[][] = [];
      for (let i = 0; i < pkgs.length; i += 6) chunks.push(pkgs.slice(i, i + 6));
      for (const chunk of chunks) lines.push(chunk.map((p) => `\`${escapeMarkdown(p)}\``).join(" · "));
      lines.push("");
    }
  }
  lines.push("");

  // ── Vulnerability-Handling-Nachweis ───────────────────────────────────────
  lines.push(`# ${S()} Vulnerability-Handling-Nachweis`);
  lines.push("");
  if (vexMap.size === 0) {
    lines.push("*Keine VEX-Aussagen erfasst. Tragen Sie Entscheidungen in `ankercode.decisions.yaml` ein.*");
  } else {
    lines.push("| Finding-ID | Status | Begründung | Verantwortlich |");
    lines.push("|---|---|---|---|");
    for (const [id, vex] of vexMap) {
      lines.push(
        `| \`${escapeMarkdown(id.slice(0, 12))}\` | ${escapeMarkdown(vex.status)} | ` +
        `${escapeMarkdown(vex.justification ?? vex.statement ?? "—")} | ${escapeMarkdown(vex.author)} |`,
      );
    }
  }
  lines.push("");

  // ── Akzeptierte Risiken ───────────────────────────────────────────────────
  lines.push(`# ${S()} Akzeptierte Risiken`);
  lines.push("");
  if (!decisions.riskAcceptances?.length) {
    lines.push("*Keine akzeptierten Risiken.*");
  } else {
    lines.push("| Finding-ID | Begründung | Akzeptiert durch | Gültig bis |");
    lines.push("|---|---|---|---|");
    for (const r of decisions.riskAcceptances) {
      lines.push(
        `| \`${escapeMarkdown(r.findingId.slice(0, 12))}\` | ${escapeMarkdown(r.reason)} | ` +
        `${escapeMarkdown(r.acceptedBy)} | ${r.expiresAt ? formatDate(r.expiresAt) : "unbegrenzt"} |`,
      );
    }
  }
  lines.push("");

  // ── Methodik ──────────────────────────────────────────────────────────────
  lines.push(`# ${S()} Methodik und Scanner-Versionen`);
  lines.push("");
  lines.push(
    "Die Analyse wurde ausschließlich lokal durchgeführt. Quellcode hat das System nicht verlassen. " +
    "Folgende Open-Source-Scanner wurden eingesetzt:",
  );
  lines.push("");
  lines.push("| Scanner | Version | Funktion |");
  lines.push("|---|---|---|");
  const SCANNER_ROLE: Record<string, string> = {
    syft:       "SBOM-Erzeugung (CycloneDX)",
    trivy:      "Schwachstellen & Lizenzen",
    "trivy-db": "CVE-Datenbank (Stand des Scans)",
    gitleaks:   "Secret Detection",
    "osv-api":  "OSV-Datenbank Abgleich",
  };
  const scannerLines = Object.entries(scanRun.scannerVersions)
    .map(([k, v]) => `| ${escapeMarkdown(k)} | ${escapeMarkdown(v)} | ${escapeMarkdown(SCANNER_ROLE[k] ?? "Analyse")} |`)
    .join("\n");
  lines.push(scannerLines);
  lines.push("");
  if (policyResult) {
    lines.push(`Policy-Datei: \`${escapeMarkdown(policyResult.policyFile)}\``);
    lines.push("");
  }
  lines.push(
    "> **Hinweis:** Dieser Bericht ist maschinell erzeugt und stellt keine Konformitätserklärung dar. " +
    "Ein Mensch ist für die Bewertung und Unterzeichnung verantwortlich.",
  );
  lines.push("");

  return lines.join("\n");
}
