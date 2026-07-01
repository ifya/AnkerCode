import { execFile } from "child_process";
import { promisify } from "util";
import { writeFileSync, readFileSync, unlinkSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import type { Finding } from "@ankercode/core";
import { makeFindingId } from "@ankercode/core";
import { scannerEnv } from "./env.js";

const exec = promisify(execFile);

interface GitleaksLeak {
  RuleID: string;
  File: string;
  StartLine: number;
  Secret?: string;
  Description?: string;
  Fingerprint?: string;
}

export async function runGitleaks(targetPath: string): Promise<Finding[]> {
  const reportPath = join(tmpdir(), `gitleaks-${randomUUID()}.json`);

  try {
    await exec(
      "gitleaks",
      [
        "detect",
        "--source", targetPath,
        "--report-format", "json",
        "--report-path", reportPath,
        "--exit-code", "0",
        "--no-git",
      ],
      { env: scannerEnv(), maxBuffer: 50 * 1024 * 1024 },
    );
  } catch (err: unknown) {
    const e = err as { code?: number };
    // exit code 1 = leaks found (report file still written), anything else is a real error
    if (e.code !== 1) throw err;
  }

  if (!existsSync(reportPath)) return [];

  const raw = readFileSync(reportPath, "utf8").trim();
  unlinkSync(reportPath);

  if (!raw || raw === "null") return [];

  const leaks: GitleaksLeak[] = JSON.parse(raw);

  return leaks.map((leak) => {
    // Include line number so two secrets with the same ruleId in the same file
    // don't hash to the same ID. Fingerprint would be more stable but contains
    // the commit SHA and rotates on history rewrites; file:line is good enough.
    const id = makeFindingId({
      type: "secret",
      packageName: `${leak.File}:${leak.StartLine}`,
      packageVersion: "",
      ruleId: leak.RuleID,
    });
    return {
      id,
      type: "secret" as const,
      severity: "high" as const,
      scope: "unknown" as const,
      source: {
        scanner: "gitleaks",
        ruleId: leak.RuleID,
        manifest: `${leak.File}:${leak.StartLine}`,
      },
      status: "open" as const,
    };
  });
}
