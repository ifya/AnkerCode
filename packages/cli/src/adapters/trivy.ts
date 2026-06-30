import { execFile } from "child_process";
import { promisify } from "util";
import type { Finding } from "@ankercode/core";
import { makeFindingId } from "@ankercode/core";
import { scannerEnv } from "./env.js";

const exec = promisify(execFile);

type TrivySeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";

interface TrivyVuln {
  VulnerabilityID: string;
  PkgName: string;
  InstalledVersion: string;
  FixedVersion?: string;
  Severity: TrivySeverity;
  Title?: string;
}

interface TrivyLicense {
  PkgName: string;
  Name: string;
  Category?: string;
  FilePath?: string;
}

interface TrivyResult {
  Target: string;
  Class: string;
  Type?: string;
  Vulnerabilities?: TrivyVuln[];
  Licenses?: TrivyLicense[];
}

interface TrivyOutput {
  Results?: TrivyResult[];
}

function mapSeverity(s: TrivySeverity): Finding["severity"] {
  switch (s) {
    case "CRITICAL": return "critical";
    case "HIGH":     return "high";
    case "MEDIUM":   return "medium";
    case "LOW":      return "low";
    default:         return "info";
  }
}

function ecosystemFromType(trivyType?: string): string {
  if (!trivyType) return "unknown";
  const map: Record<string, string> = {
    npm: "npm", yarn: "npm", pnpm: "npm",
    pip: "pypi", pipenv: "pypi", poetry: "pypi",
    "go-module": "go",
    cargo: "crates.io",
    gem: "rubygems",
    nuget: "nuget",
    maven: "maven",
  };
  return map[trivyType] ?? trivyType;
}

export async function runTrivy(
  targetPath: string,
  opts: { vulns?: boolean; licenses?: boolean } = { vulns: true, licenses: true },
): Promise<Finding[]> {
  const scanners = [opts.vulns && "vuln", opts.licenses && "license"].filter(Boolean).join(",");
  if (!scanners) return [];

  let stdout: string;
  try {
    ({ stdout } = await exec(
      "trivy",
      [
        "fs", targetPath,
        "--format", "json",
        "--scanners", scanners,
        "--quiet",
        "--exit-code", "0",
      ],
      { env: scannerEnv(), maxBuffer: 100 * 1024 * 1024 },
    ));
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; code?: number };
    // trivy exits non-zero on scan errors, but may still emit valid JSON
    if (!e.stdout) throw err;
    stdout = e.stdout;
  }

  const output: TrivyOutput = JSON.parse(stdout);
  const findings: Finding[] = [];

  for (const result of output.Results ?? []) {
    for (const vuln of result.Vulnerabilities ?? []) {
      const id = makeFindingId({
        type: "vulnerability",
        packageName: vuln.PkgName,
        packageVersion: vuln.InstalledVersion,
        ruleId: vuln.VulnerabilityID,
      });
      findings.push({
        id,
        type: "vulnerability",
        severity: mapSeverity(vuln.Severity),
        package: {
          name: vuln.PkgName,
          version: vuln.InstalledVersion,
          ecosystem: ecosystemFromType(result.Type),
        },
        scope: "unknown",
        cveId: vuln.VulnerabilityID,
        fixAvailable: Boolean(vuln.FixedVersion),
        recommendedAction: vuln.FixedVersion ? `Upgrade to ${vuln.FixedVersion}` : undefined,
        source: { scanner: "trivy", ruleId: vuln.VulnerabilityID, manifest: result.Target },
        status: "open",
      });
    }

    for (const lic of result.Licenses ?? []) {
      const id = makeFindingId({
        type: "license",
        packageName: lic.PkgName,
        packageVersion: "",
        ruleId: lic.Name,
      });
      findings.push({
        id,
        type: "license",
        severity: "info",
        package: { name: lic.PkgName, version: "", ecosystem: "unknown" },
        scope: "unknown",
        license: lic.Name,
        source: {
          scanner: "trivy",
          ruleId: lic.Name,
          manifest: lic.FilePath ?? result.Target,
        },
        status: "open",
      });
    }
  }

  return findings;
}
