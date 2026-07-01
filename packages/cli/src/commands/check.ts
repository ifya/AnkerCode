import { existsSync } from "fs";
import { resolve, join } from "path";
import { runScan } from "./scan.js";
import { runReport } from "./report.js";
import { computePolicyResult } from "./policy.js";

export interface CheckOptions {
  project?: string;
  pdf:      boolean;
  html:     boolean;
  docx:     boolean;
}

export async function runCheck(targetPath: string, opts: CheckOptions): Promise<void> {
  const target = resolve(targetPath);

  const formats = {
    pdf:  opts.pdf  || (!opts.pdf && !opts.html && !opts.docx),
    html: opts.html || (!opts.pdf && !opts.html && !opts.docx),
    docx: opts.docx || (!opts.pdf && !opts.html && !opts.docx),
  };

  const scanOpts: Parameters<typeof runScan>[1] = {};
  if (opts.project !== undefined) scanOpts.project = opts.project;

  // 1. Scan
  await runScan(target, scanOpts);

  // 2. Policy check — only if ankercode.policy.yaml exists
  const policyPath = join(target, "ankercode.policy.yaml");
  let policyViolated = false;
  if (existsSync(policyPath)) {
    try {
      const result = await computePolicyResult(target);
      if (!result.passed) {
        policyViolated = true;
        console.error(
          `\n  ✗ Policy-Verstoß: ${result.violations.length} Verstoß/Verstöße gefunden.`,
        );
        console.error("    Report wird trotzdem generiert.\n");
      }
    } catch (err) {
      console.error(`  Warnung: Policy-Auswertung fehlgeschlagen — ${(err as Error).message}`);
    }
  }

  // 3. Report (picks up policy-result.json automatically)
  await runReport(target, { ...formats });

  // Exit 2 after report is written so the artifact is always available in CI
  if (policyViolated) process.exit(2);
}
