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

async function getGitMeta(targetPath: string): Promise<{ commitSha?: string; branch?: string }> {
  const env = scannerEnv();
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

export interface ScanOptions {
  project?: string;
  sbom?: boolean;
  vulns?: boolean;
  licenses?: boolean;
  secrets?: boolean;
  code?: boolean;
}

export async function runScan(targetPath: string, opts: ScanOptions): Promise<void> {
  const target = resolve(targetPath);
  if (!existsSync(target)) {
    console.error(`Error: path does not exist: ${target}`);
    process.exit(1);
  }

  const outputDir = join(target, "ankercode");
  mkdirSync(outputDir, { recursive: true });

  const projectName = opts.project ?? target.split("/").pop() ?? "unknown";

  // if no flags given, run everything
  const runAll = !opts.sbom && !opts.vulns && !opts.licenses && !opts.secrets && !opts.code;
  const doSbom     = runAll || Boolean(opts.sbom);
  const doVulns    = runAll || Boolean(opts.vulns);
  const doLicenses = runAll || Boolean(opts.licenses);
  const doSecrets  = runAll || Boolean(opts.secrets);
  const doCode     = runAll || Boolean(opts.code);

  const activeScans = [
    doSbom     && "sbom",
    doVulns    && "vulns",
    doLicenses && "licenses",
    doSecrets  && "secrets",
    doCode     && "code",
  ].filter(Boolean).join(", ");

  console.log(`\nAnkerCode scan — ${projectName}`);
  console.log(`Target  : ${target}`);
  console.log(`Output  : ${outputDir}`);
  console.log(`Scans   : ${activeScans}\n`);

  console.log("Detecting scanner versions...");
  const scannerVersions = await getScannerVersions();
  const versionLines = Object.entries(scannerVersions)
    .map(([k, v]) => `  ${k.padEnd(12)} ${v}`)
    .join("\n");
  console.log(versionLines || "  (no scanners found in PATH)");
  console.log();

  const gitMeta = await getGitMeta(target);

  let sbomRef = undefined;
  if (doSbom) {
    console.log("Running Syft (SBOM)...");
    try {
      sbomRef = await runSyft(target, outputDir);
      console.log(`  SBOM written → ${sbomRef.path}`);
    } catch (e) {
      console.warn(`  Syft failed: ${(e as Error).message}`);
    }
  }

  let trivyFindings: Awaited<ReturnType<typeof runTrivy>> = [];
  if (doVulns || doLicenses) {
    const label = [doVulns && "vulnerabilities", doLicenses && "licenses"].filter(Boolean).join(" + ");
    console.log(`Running Trivy (${label})...`);
    try {
      trivyFindings = await runTrivy(target, { vulns: doVulns, licenses: doLicenses });
      const vulns = trivyFindings.filter((f) => f.type === "vulnerability").length;
      const lics  = trivyFindings.filter((f) => f.type === "license").length;
      if (doVulns)    console.log(`  ${vulns} vulnerabilities`);
      if (doLicenses) console.log(`  ${lics} license entries`);
    } catch (e) {
      console.warn(`  Trivy failed: ${(e as Error).message}`);
    }
  }

  let secretFindings: Awaited<ReturnType<typeof runGitleaks>> = [];
  if (doSecrets) {
    console.log("Running Gitleaks (secrets)...");
    try {
      secretFindings = await runGitleaks(target);
      console.log(`  ${secretFindings.length} potential secrets found`);
    } catch (e) {
      console.warn(`  Gitleaks failed: ${(e as Error).message}`);
    }
  }

  if (doCode) {
    console.log("Running Semgrep (code analysis)... [coming in Phase 1]");
  }

  const allFindings = [...trivyFindings, ...secretFindings];

  const scanRun: ScanRun = {
    id: randomUUID(),
    project: projectName,
    ...(gitMeta.commitSha !== undefined && { commitSha: gitMeta.commitSha }),
    ...(gitMeta.branch !== undefined && { branch: gitMeta.branch }),
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
        project: projectName,
        scanRunId: scanRun.id,
        findingCount: allFindings.length,
        scannerVersions,
      },
    },
    outputDir,
  );

  const critHigh = allFindings.filter(
    (f) => f.type === "vulnerability" && (f.severity === "critical" || f.severity === "high"),
  ).length;

  console.log(`\nDone.`);
  console.log(`  Total findings    : ${allFindings.length}`);
  console.log(`  Critical/High CVE : ${critHigh}`);
  console.log(`  Findings written  → ${findingsPath}`);
  if (sbomRef) console.log(`  SBOM written      → ${sbomRef.path}`);
  console.log();
}
