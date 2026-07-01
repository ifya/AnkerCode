import { existsSync, readFileSync, writeFileSync } from "fs";
import { resolve, join } from "path";
import type { PolicyResult, ScanRun } from "@ankercode/core";
import { loadDecisions } from "@ankercode/report";
import { loadPolicy } from "../policy/loader.js";
import { evaluatePolicy } from "../policy/evaluator.js";

export interface PolicyCheckOptions {
  policy?:     string;   // path override for policy file
  quiet?:      boolean;
  failOnWarn?: boolean;  // also exit 2 on warnings
}

// ── Shared computation (used by both the CLI command and ankercode check) ────

export async function computePolicyResult(
  targetPath:     string,
  policyOverride?: string,
): Promise<PolicyResult> {
  const target     = resolve(targetPath);
  const outputDir  = join(target, "ankercode");
  const findingsPath = join(outputDir, "findings.json");

  if (!existsSync(findingsPath)) {
    throw new Error(
      `Keine findings.json in ${outputDir}.\n  Führen Sie zuerst 'ankercode scan' aus.`,
    );
  }

  const policyPath = policyOverride
    ? resolve(policyOverride)
    : join(target, "ankercode.policy.yaml");

  if (!existsSync(policyPath)) {
    throw new Error(
      `Keine Policy-Datei: ${policyPath}\n  Erstellen Sie ankercode.policy.yaml oder führen Sie 'ankercode init' aus.`,
    );
  }

  const scanRun: ScanRun = JSON.parse(readFileSync(findingsPath, "utf8"));
  const decisions        = loadDecisions(target);
  const policy           = loadPolicy(policyPath);
  const result           = evaluatePolicy(scanRun.findings, policy, decisions, policyPath);

  // Write alongside findings.json so ankercode report picks it up automatically
  writeFileSync(
    join(outputDir, "policy-result.json"),
    JSON.stringify(result, null, 2),
    "utf8",
  );

  return result;
}

// ── CLI entry point ───────────────────────────────────────────────────────────

export async function runPolicyCheck(
  targetPath: string,
  opts: PolicyCheckOptions,
): Promise<void> {
  let result: PolicyResult;
  try {
    result = await computePolicyResult(targetPath, opts.policy);
  } catch (err) {
    console.error(`\n  Fehler: ${(err as Error).message}`);
    process.exit(1);
  }

  if (opts.quiet) {
    process.stdout.write(
      JSON.stringify({
        ok:         result.passed,
        violations: result.violations.length,
        warnings:   result.warnings.length,
        policyFile: result.policyFile,
      }) + "\n",
    );
  } else {
    const icon   = result.passed ? "✓" : "✗";
    const status = result.passed ? "BESTANDEN" : "NICHT BESTANDEN";
    console.log(`\nPolicy-Bewertung — ${icon} ${status}`);
    console.log(`  Verstöße : ${result.violations.length}`);
    console.log(`  Warnungen: ${result.warnings.length}`);

    if (result.violations.length > 0) {
      console.log("\n  Verstöße:");
      for (const v of result.violations) {
        console.log(`    ✗  [${v.ruleId}] ${v.message}`);
      }
    }
    if (result.warnings.length > 0) {
      console.log("\n  Warnungen:");
      for (const w of result.warnings) {
        console.log(`    ⚠  [${w.ruleId}] ${w.message}`);
      }
    }
    console.log();
  }

  const shouldFail = !result.passed || (opts.failOnWarn && result.warnings.length > 0);
  if (shouldFail) process.exit(2);
}
