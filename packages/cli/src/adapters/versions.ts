import { execFile } from "child_process";
import { promisify } from "util";
import { scannerEnv } from "./env.js";

const exec = promisify(execFile);

export async function getScannerVersions(): Promise<Record<string, string>> {
  const versions: Record<string, string> = {};
  const env = scannerEnv();

  await Promise.allSettled([
    exec("syft", ["--version"], { env }).then(({ stdout }) => {
      const m = stdout.match(/syft\s+([\d.]+)/);
      if (m?.[1]) versions["syft"] = m[1];
    }),
    exec("trivy", ["version", "--format", "json"], { env }).then(({ stdout }) => {
      const parsed = JSON.parse(stdout) as {
        Version?: string;
        VulnerabilityDB?: { UpdatedAt?: string };
      };
      if (parsed.Version) versions["trivy"] = parsed.Version;
      const dbDate = parsed.VulnerabilityDB?.UpdatedAt;
      if (dbDate) versions["trivy-db"] = dbDate.slice(0, 10); // YYYY-MM-DD
    }),
    exec("gitleaks", ["version"], { env }).then(({ stdout }) => {
      const v = stdout.trim();
      if (v) versions["gitleaks"] = v;
    }),
  ]);

  // OSV API doesn't have a version, record the schema version
  versions["osv-api"] = "v1";

  return versions;
}
