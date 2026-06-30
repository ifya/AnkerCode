import type { ScanRun, Finding } from "@ankercode/core";
import type { Decisions } from "./decisions.js";

function severityLabel(s: Finding["severity"]): string {
  const map: Record<Finding["severity"], string> = {
    critical: "KRITISCH",
    high: "HOCH",
    medium: "MITTEL",
    low: "NIEDRIG",
    info: "INFO",
  };
  return map[s];
}

function severityDot(s: Finding["severity"]): string {
  const colors: Record<Finding["severity"], string> = {
    critical: "#dc2626",
    high:     "#ea580c",
    medium:   "#d97706",
    low:      "#2563eb",
    info:     "#9ca3af",
  };
  return `<span style="color:${colors[s]};font-size:1.1em">●</span>`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function escapeMarkdown(s: string): string {
  return s.replace(/[\\`*_{}[\]()#+\-.!|]/g, "\\$&");
}

function sortedFindings(findings: Finding[]): Finding[] {
  const order: Record<Finding["severity"], number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
    info: 4,
  };
  return [...findings].sort((a, b) => order[a.severity] - order[b.severity]);
}

export function renderReportMarkdown(scanRun: ScanRun, decisions: Decisions): string {
  const vulnFindings = sortedFindings(
    scanRun.findings.filter((f) => f.type === "vulnerability"),
  );
  const licenseFindings = scanRun.findings.filter((f) => f.type === "license");
  const secretFindings = scanRun.findings.filter((f) => f.type === "secret");

  const acceptedIds = new Set((decisions.riskAcceptances ?? []).map((r) => r.findingId));
  const vexMap = new Map(
    (decisions.vex ?? []).map((v) => [v.findingId, v]),
  );

  const openVulns = vulnFindings.filter(
    (f) => !acceptedIds.has(f.id) && vexMap.get(f.id)?.status !== "not_affected",
  );
  const critHigh = openVulns.filter(
    (f) => f.severity === "critical" || f.severity === "high",
  );

  const scannerVersionLines = Object.entries(scanRun.scannerVersions)
    .map(([k, v]) => `| ${escapeMarkdown(k)} | ${escapeMarkdown(v)} |`)
    .join("\n");

  const lines: string[] = [];

  // ── Header ──────────────────────────────────────────────────────────────
  lines.push(`% CRA Readiness Evidence Report`);
  lines.push(`% ${escapeMarkdown(scanRun.project)}`);
  lines.push(`% ${formatDate(scanRun.createdAt)}`);
  lines.push("");

  // ── 1. Zusammenfassung ───────────────────────────────────────────────────
  lines.push("# 1. Zusammenfassung");
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
  if (scanRun.branch) lines.push(`| Branch | \`${escapeMarkdown(scanRun.branch)}\` |`);
  if (scanRun.commitSha) lines.push(`| Commit | \`${escapeMarkdown(scanRun.commitSha.slice(0, 12))}\` |`);
  lines.push(`| Gefundene Schwachstellen (gesamt) | ${vulnFindings.length} |`);
  lines.push(`| Davon Kritisch/Hoch (offen) | ${critHigh.length} |`);
  lines.push(`| Secrets-Treffer | ${secretFindings.length} |`);
  lines.push(`| Lizenzen erfasst | ${licenseFindings.length} |`);
  lines.push(`| Akzeptierte Risiken | ${decisions.riskAcceptances?.length ?? 0} |`);
  lines.push("");

  // ── 2. SBOM-Zusammenfassung ──────────────────────────────────────────────
  lines.push("# 2. SBOM-Zusammenfassung");
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

  // ── 3. Alle Schwachstellen ───────────────────────────────────────────────
  lines.push("# 3. Schwachstellen");
  lines.push("");
  if (openVulns.length === 0) {
    lines.push("*Keine offenen Schwachstellen gefunden.*");
  } else {
    const bySeverity: Array<[Finding["severity"], string]> = [
      ["critical", "Kritisch"],
      ["high",     "Hoch"],
      ["medium",   "Mittel"],
      ["low",      "Niedrig"],
      ["info",     "Info"],
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

  // ── 4. Lizenz-Risiko ────────────────────────────────────────────────────
  lines.push("# 4. Lizenz-Risiko");
  lines.push("");
  if (licenseFindings.length === 0) {
    lines.push("*Keine Lizenzen erfasst.*");
  } else {
    const byLicense = new Map<string, string[]>();
    for (const f of licenseFindings) {
      const lic = f.license ?? "unbekannt";
      const existing = byLicense.get(lic) ?? [];
      if (f.package?.name && !existing.includes(f.package.name)) {
        existing.push(f.package.name);
      }
      byLicense.set(lic, existing);
    }

    const sorted = [...byLicense.entries()].sort((a, b) => b[1].length - a[1].length);

    // Summary table
    lines.push("| Lizenz | Anzahl Pakete |");
    lines.push("|---|---|");
    for (const [lic, pkgs] of sorted) {
      lines.push(`| ${escapeMarkdown(lic)} | ${pkgs.length} |`);
    }
    lines.push("");

    // Per-license package list
    for (const [lic, pkgs] of sorted) {
      lines.push(`**${escapeMarkdown(lic)}**`);
      lines.push("");
      // Wrap into rows of 6 to keep lines readable
      const chunks: string[][] = [];
      for (let i = 0; i < pkgs.length; i += 6) chunks.push(pkgs.slice(i, i + 6));
      for (const chunk of chunks) {
        lines.push(chunk.map((p) => `\`${escapeMarkdown(p)}\``).join(" · "));
      }
      lines.push("");
    }
  }
  lines.push("");

  // ── 5. Vulnerability-Handling-Nachweis ──────────────────────────────────
  lines.push("# 5. Vulnerability-Handling-Nachweis");
  lines.push("");
  if (vexMap.size === 0) {
    lines.push(
      "*Keine VEX-Aussagen erfasst. Tragen Sie Entscheidungen in `ankercode.decisions.yaml` ein.*",
    );
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

  // ── 6. Akzeptierte Risiken ───────────────────────────────────────────────
  lines.push("# 6. Akzeptierte Risiken");
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

  // ── 7. Methodik und Scanner-Versionen ───────────────────────────────────
  lines.push("# 7. Methodik und Scanner-Versionen");
  lines.push("");
  lines.push(
    "Die Analyse wurde ausschließlich lokal durchgeführt. Quellcode hat das System nicht verlassen. " +
      "Folgende Open-Source-Scanner wurden eingesetzt:",
  );
  lines.push("");
  lines.push("| Scanner | Version |");
  lines.push("|---|---|");
  lines.push(scannerVersionLines);
  lines.push("");
  lines.push(
    "> **Hinweis:** Dieser Bericht ist maschinell erzeugt und stellt keine Konformitätserklärung dar. " +
      "Ein Mensch ist für die Bewertung und Unterzeichnung verantwortlich.",
  );
  lines.push("");

  return lines.join("\n");
}
