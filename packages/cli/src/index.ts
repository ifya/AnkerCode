import { Command } from "commander";
import { runScan } from "./commands/scan.js";
import { runReport } from "./commands/report.js";
import { runInit } from "./commands/init.js";
import { runCheck } from "./commands/check.js";
import { runUpgrade } from "./commands/upgrade.js";
import { runUpload } from "./commands/upload.js";
import { runConfig } from "./commands/config-cmd.js";
import { runPolicyCheck } from "./commands/policy.js";

const program = new Command();

program
  .name("ankercode")
  .description("Local-first CRA/BSI compliance evidence tool")
  .version("0.1.0");

program
  .command("scan [path]")
  .description("Run scanners and write findings + SBOM to <path>/ankercode/")
  .option("--project <name>",        "Logical project name (defaults to directory name)")
  .option("--output-dir <dir>",      "Write findings.json + SBOM here instead of <path>/ankercode/")
  .option("--fail-on <level>",       "Exit 2 if findings at or above: critical|high|medium|low|any")
  .option("--quiet",                 "Suppress human output; print JSON summary to stdout (CI mode)")
  .option("--sbom",                  "SBOM only (Syft → CycloneDX)")
  .option("--vulns",                 "Vulnerabilities only (Trivy)")
  .option("--licenses",              "License inventory only (Trivy)")
  .option("--secrets",               "Secret detection only (Gitleaks)")
  .option("--code",                  "Code analysis only (Semgrep — Phase 1)")
  .action(async (
    targetPath: string | undefined,
    opts: {
      project?:   string;
      outputDir?: string;
      failOn?:    string;
      quiet?:     boolean;
      sbom?:      boolean;
      vulns?:     boolean;
      licenses?:  boolean;
      secrets?:   boolean;
      code?:      boolean;
    },
  ) => {
    const validLevels = ["critical", "high", "medium", "low", "any"];
    if (opts.failOn && !validLevels.includes(opts.failOn)) {
      console.error(`Error: --fail-on must be one of: ${validLevels.join(", ")}`);
      process.exit(1);
    }
    const scanOpts: import("./commands/scan.js").ScanOptions = {};
    if (opts.project   !== undefined) scanOpts.project   = opts.project;
    if (opts.outputDir !== undefined) scanOpts.outputDir = opts.outputDir;
    if (opts.failOn    !== undefined) scanOpts.failOn    = opts.failOn as import("./commands/scan.js").FailOnLevel;
    if (opts.quiet)    scanOpts.quiet    = true;
    if (opts.sbom)     scanOpts.sbom     = true;
    if (opts.vulns)    scanOpts.vulns    = true;
    if (opts.licenses) scanOpts.licenses = true;
    if (opts.secrets)  scanOpts.secrets  = true;
    if (opts.code)     scanOpts.code     = true;
    await runScan(targetPath ?? ".", scanOpts);
  });

program
  .command("report [path]")
  .description("Generate report from findings.json in <path>/ankercode/")
  .option("--pdf", "Generate PDF (requires wkhtmltopdf)")
  .option("--html", "Generate standalone HTML")
  .option("--docx", "Generate Word document")
  .option("--output <file>", "Override output file path")
  .action(
    async (
      targetPath: string | undefined,
      opts: { pdf: boolean; html: boolean; docx: boolean; output?: string },
    ) => {
      await runReport(targetPath ?? ".", opts);
    },
  );

program
  .command("init [path]")
  .description("Create ankercode.decisions.yaml template in <path>")
  .action(async (targetPath: string | undefined) => {
    await runInit(targetPath ?? ".");
  });

program
  .command("check [path]")
  .description("Scan + generate all reports in one command (PDF · HTML · DOCX)")
  .option("--project <name>", "Logical project name (defaults to directory name)")
  .option("--pdf",  "Generate PDF only")
  .option("--html", "Generate HTML only")
  .option("--docx", "Generate DOCX only")
  .action(async (
    targetPath: string | undefined,
    opts: { project?: string; pdf: boolean; html: boolean; docx: boolean },
  ) => {
    await runCheck(targetPath ?? ".", opts);
  });

const policy = program
  .command("policy")
  .description("Policy management — define and evaluate compliance rules");

policy
  .command("check [path]")
  .description("Evaluate findings against ankercode.policy.yaml")
  .option("--policy <file>",   "Policy file override (default: ankercode.policy.yaml)")
  .option("--quiet",            "Suppress human output; print JSON summary to stdout")
  .option("--fail-on-warn",    "Also exit 2 on warnings (default: only on violations)")
  .action(async (
    targetPath: string | undefined,
    opts: { policy?: string; quiet?: boolean; failOnWarn?: boolean },
  ) => {
    const policyOpts: import("./commands/policy.js").PolicyCheckOptions = {};
    if (opts.policy    !== undefined) policyOpts.policy     = opts.policy;
    if (opts.quiet)                   policyOpts.quiet       = true;
    if (opts.failOnWarn)              policyOpts.failOnWarn  = true;
    await runPolicyCheck(targetPath ?? ".", policyOpts);
  });

program
  .command("upgrade")
  .description("Pull latest AnkerCode and rebuild. Use --scanners to also update Syft, Trivy, Gitleaks, Pandoc.")
  .option("--scanners", "Also update all scanner dependencies")
  .action(async (opts: { scanners: boolean }) => {
    await runUpgrade(opts);
  });

program
  .command("upload [path]")
  .description("Upload scan results to AnkerCode Cloud (opt-in)")
  .requiredOption("--org <slug>",     "Organization slug (must match your API key)")
  .requiredOption("--project <slug>", "Project slug (created if it doesn't exist)")
  .option("--repo-url <url>",         "Git remote URL (stored with the project)")
  .option("--url <url>",              "Cloud URL override (default: ANKERCODE_URL or config)")
  .option("--key <key>",              "API key override (default: ANKERCODE_API_KEY or config)")
  .action(async (
    targetPath: string | undefined,
    opts: { org: string; project: string; repoUrl?: string; url?: string; key?: string },
  ) => {
    await runUpload(targetPath ?? ".", opts);
  });

program
  .command("config <action> [key] [value]")
  .description("Manage CLI configuration (~/.ankercode/config.json)")
  .addHelpText("after", `
Actions:
  show              Print current config
  get <url|key>     Print a single value
  set url  <url>    Set cloud URL
  set key  <key>    Set API key (ank_live_...)
  `)
  .action(async (action: "set" | "get" | "show", keyName?: string, value?: string) => {
    await runConfig(action, keyName, value);
  });

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error((err as Error).message);
  process.exit(1);
});
