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
    exec("trivy", ["--version"], { env }).then(({ stdout }) => {
      const m = stdout.match(/Version:\s+([\d.]+)/);
      if (m?.[1]) versions["trivy"] = m[1];
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
