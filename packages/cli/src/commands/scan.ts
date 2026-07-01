import { mkdirSync, writeFileSync, existsSync } from "fs";
import { resolve, join } from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { randomUUID } from "crypto";
import type { ScanRun } from "@ankercode/core";
import { emitAuditEvent } from "@ankercode/core";
import { getScannerVersions } from "../adapters/versions.js";
import { runSyft } from "../adapters/syft.js";
import { runTrivy } from "../adapters/trivy.js";
import { runGitleaks } from "../adapters/gitleaks.js";
import { scannerEnv } from "../adapters/env.js";

const exec = promisify(execFile);

// ── Exit codes ────────────────────────────────────────────────────────────────
// 0 — clean / policy threshold not exceeded
// 1 — runtime error (bad path, scanner crashed, unhandled exception)
// 2 — scan succeeded but --fail-on threshold was exceeded (policy violation)
//
// Separating 1 and 2 lets CI distinguish "pipeline broken" from "code has findings"
// so teams can treat them differently (alert vs. block).

export const EXIT_ERROR   = 1;
export const EXIT_POLICY  = 2;

// ── Severity ranking (shared with policy check) ───────────────────────────────

export const SEV_RANK: Record<string, number> = {
  critical: 4,
  high:     3,
  medium:   2,
  low:      1,
  info:     0,
};

export type FailOnLevel = "critical" | "high" | "medium" | "low" | "any";

// ── Options ───────────────────────────────────────────────────────────────────

export interface ScanOptions {
  project?:    string;
  outputDir?:  string;  // default: <target>/ankercode/
  quiet?:      boolean; // suppress human-readable output; print JSON summary to stdout
  failOn?:     FailOnLevel; // exit 2 when any finding meets or exceeds this severity
  sbom?:       boolean;
  vulns?:      boolean;
  licenses?:   boolean;
  secrets?:    boolean;
  code?:       boolean;
}

// ── Logger ────────────────────────────────────────────────────────────────────
// Errors always go to stderr. Human log goes to stderr in quiet mode so stdout
// stays clean for the JSON summary.

function makeLogger(quiet: boolean) {
  return {
    log:  (...a: unknown[]) => { if (!quiet) console.log(...a); },
    warn: (...a: unknown[]) => { console.error(...a); },         // always visible
    err:  (...a: unknown[]) => { console.error(...a); },
  };
}

// ── Git metadata ──────────────────────────────────────────────────────────────

async function getGitMeta(targetPath: string): Promise<{ commitSha?: string; branch?: string }> {
  const env  = scannerEnv();
  const opts = { cwd: targetPath, env };
  const meta: { commitSha?: string; branch?: string } = {};
  await Promise.allSettled([
    exec("git", ["rev-parse", "HEAD"], opts).then(({ stdout }) => {
      meta.commitSha = stdout.trim();
    }),
    exec("git", ["rev-parse", "--abbrev-ref", "HEAD"], opts).then(({ stdout }) => {
      meta.branch = stdout.trim();
    }),
  ]);
  return meta;
}

// ── Main ──────────────────────────────────────────────────────────────────────

export async function runScan(targetPath: string, opts: ScanOptions): Promise<void> {
  const target = resolve(targetPath);
  if (!existsSync(target)) {
    console.error(`Error: path does not exist: ${target}`);
    process.exit(EXIT_ERROR);
  }

  const quiet     = Boolean(opts.quiet);
  const log       = makeLogger(quiet);
  const outputDir = opts.outputDir ? resolve(opts.outputDir) : join(target, "ankercode");
  mkdirSync(outputDir, { recursive: true });

  const projectName = opts.project ?? target.split("/").pop() ?? "unknown";

  const runAll      = !opts.sbom && !opts.vulns && !opts.licenses && !opts.secrets && !opts.code;
  const doSbom      = runAll || Boolean(opts.sbom);
  const doVulns     = runAll || Boolean(opts.vulns);
  const doLicenses  = runAll || Boolean(opts.licenses);
  const doSecrets   = runAll || Boolean(opts.secrets);
  const doCode      = runAll || Boolean(opts.code);

  const activeScans = [
    doSbom     && "sbom",
    doVulns    && "vulns",
    doLicenses && "licenses",
    doSecrets  && "secrets",
    doCode     && "code",
  ].filter(Boolean).join(", ");

  log.log(`\nAnkerCode scan — ${projectName}`);
  log.log(`Target    : ${target}`);
  log.log(`Output    : ${outputDir}`);
  log.log(`Scans     : ${activeScans}`);
  if (opts.failOn) log.log(`Fail-on   : ${opts.failOn}`);
  log.log();

  log.log("Detecting scanner versions...");
  const scannerVersions = await getScannerVersions();
  log.log(
    Object.entries(scannerVersions).map(([k, v]) => `  ${k.padEnd(12)} ${v}`).join("\n")
    || "  (no scanners found in PATH)"
  );
  log.log();

  const gitMeta = await getGitMeta(target);

  // ── Syft ──────────────────────────────────────────────────────────────────
  let sbomRef = undefined;
  if (doSbom) {
    log.log("Running Syft (SBOM)...");
    try {
      sbomRef = await runSyft(target, outputDir);
      log.log(`  SBOM written → ${sbomRef.path}`);
    } catch (e) {
      log.warn(`  Syft failed: ${(e as Error).message}`);
    }
  }

  // ── Trivy ─────────────────────────────────────────────────────────────────
  let trivyFindings: Awaited<ReturnType<typeof runTrivy>> = [];
  if (doVulns || doLicenses) {
    const label = [doVulns && "vulnerabilities", doLicenses && "licenses"].filter(Boolean).join(" + ");
    log.log(`Running Trivy (${label})...`);
    try {
      trivyFindings = await runTrivy(target, { vulns: doVulns, licenses: doLicenses });
      if (doVulns)    log.log(`  ${trivyFindings.filter((f) => f.type === "vulnerability").length} vulnerabilities`);
      if (doLicenses) log.log(`  ${trivyFindings.filter((f) => f.type === "license").length} license entries`);
    } catch (e) {
      log.warn(`  Trivy failed: ${(e as Error).message}`);
      if ((e as Error).message.includes("429")) {
        log.warn("  Tip: run `mvn dependency:resolve` first to warm ~/.m2 and avoid Maven Central rate limits.");
      }
    }
  }

  // ── Gitleaks ──────────────────────────────────────────────────────────────
  let secretFindings: Awaited<ReturnType<typeof runGitleaks>> = [];
  if (doSecrets) {
    log.log("Running Gitleaks (secrets)...");
    try {
      secretFindings = await runGitleaks(target);
      log.log(`  ${secretFindings.length} potential secrets found`);
    } catch (e) {
      log.warn(`  Gitleaks failed: ${(e as Error).message}`);
    }
  }

  if (doCode) {
    log.log("Running Semgrep (code analysis)... [coming in Phase 1]");
  }

  // OSV adapter intentionally removed — air-gap first.
  // api.osv.dev would send package names+versions externally.
  // Trivy covers the same advisories when its scan completes without
  // rate-limit interruption (warm Maven cache prevents the 429).
  const osvFindings: never[] = [];

  // ── Deduplicate ───────────────────────────────────────────────────────────
  // Same (type, package, version, ruleId) → same finding ID. Keeps the first
  // occurrence (Trivy wins over OSV for the same CVE since it's more detailed).
  const seenIds = new Map<string, typeof trivyFindings[0]>();
  for (const f of [...trivyFindings, ...osvFindings, ...secretFindings]) {
    if (!seenIds.has(f.id)) seenIds.set(f.id, f);
  }
  const allFindings = [...seenIds.values()];

  // ── Write artifacts ───────────────────────────────────────────────────────
  const scanRun: ScanRun = {
    id: randomUUID(),
    project: projectName,
    ...(gitMeta.commitSha !== undefined && { commitSha: gitMeta.commitSha }),
    ...(gitMeta.branch    !== undefined && { branch:    gitMeta.branch }),
    scannerVersions,
    createdAt: new Date().toISOString(),
    ...(sbomRef !== undefined && { sbomRef }),
    findings: allFindings,
  };

  const findingsPath = join(outputDir, "findings.json");
  writeFileSync(findingsPath, JSON.stringify(scanRun, null, 2), "utf8");

  emitAuditEvent(
    {
      actor: "cli",
      action: "scan.run",
      metadata: {
        project:      projectName,
        scanRunId:    scanRun.id,
        findingCount: allFindings.length,
        scannerVersions,
      },
    },
    outputDir,
  );

  // ── Summary ───────────────────────────────────────────────────────────────
  const counts = {
    critical: allFindings.filter((f) => f.severity === "critical").length,
    high:     allFindings.filter((f) => f.severity === "high").length,
    medium:   allFindings.filter((f) => f.severity === "medium").length,
    low:      allFindings.filter((f) => f.severity === "low").length,
    info:     allFindings.filter((f) => f.severity === "info").length,
    total:    allFindings.length,
  };

  if (quiet) {
    // Machine-readable summary to stdout — parseable by CI scripts / downstream tools
    process.stdout.write(
      JSON.stringify({
        ok:          true,
        project:     projectName,
        scanRunId:   scanRun.id,
        commitSha:   gitMeta.commitSha,
        branch:      gitMeta.branch,
        findings:    counts,
        findingsPath,
        sbomPath:    sbomRef?.path,
        scannerVersions,
      }) + "\n"
    );
  } else {
    log.log(`\nDone.`);
    log.log(`  Total findings    : ${counts.total}`);
    log.log(`  Critical          : ${counts.critical}`);
    log.log(`  High              : ${counts.high}`);
    log.log(`  Medium            : ${counts.medium}`);
    log.log(`  Low               : ${counts.low}`);
    log.log(`  Findings written  → ${findingsPath}`);
    if (sbomRef) log.log(`  SBOM written      → ${sbomRef.path}`);
    log.log();
  }

  // ── Policy gate ───────────────────────────────────────────────────────────
  if (opts.failOn) {
    const threshold = opts.failOn === "any" ? 0 : (SEV_RANK[opts.failOn] ?? 0);
    const violations = allFindings.filter(
      (f) => (SEV_RANK[f.severity] ?? 0) >= threshold,
    );
    if (violations.length > 0) {
      const msg = `Policy gate: ${violations.length} finding(s) at or above "${opts.failOn}" threshold.`;
      if (quiet) {
        // Overwrite the JSON line with failure flag so CI scripts can detect it
        process.stdout.write(
          JSON.stringify({
            ok:         false,
            project:    projectName,
            scanRunId:  scanRun.id,
            policyGate: { failOn: opts.failOn, violations: violations.length },
            findings:   counts,
            findingsPath,
          }) + "\n"
        );
      } else {
        console.error(`\n  ✗ ${msg}`);
      }
      process.exit(EXIT_POLICY);
    }
  }
}
