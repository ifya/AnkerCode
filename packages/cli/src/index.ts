import { Command } from "commander";
import { runScan } from "./commands/scan.js";
import { runReport } from "./commands/report.js";
import { runInit } from "./commands/init.js";
import { runCheck } from "./commands/check.js";
import { runUpgrade } from "./commands/upgrade.js";

const program = new Command();

program
  .name("ankercode")
  .description("Local-first CRA/BSI compliance evidence tool")
  .version("0.1.0");

program
  .command("scan [path]")
  .description("Run scanners and write findings + SBOM to <path>/ankercode/")
  .option("--project <name>", "Logical project name (defaults to directory name)")
  .option("--sbom",     "SBOM only (Syft → CycloneDX)")
  .option("--vulns",    "Vulnerabilities only (Trivy)")
  .option("--licenses", "License inventory only (Trivy)")
  .option("--secrets",  "Secret detection only (Gitleaks)")
  .option("--code",     "Code analysis only (Semgrep — Phase 1)")
  .action(async (
    targetPath: string | undefined,
    opts: { project?: string; sbom?: boolean; vulns?: boolean; licenses?: boolean; secrets?: boolean; code?: boolean },
  ) => {
    await runScan(targetPath ?? ".", opts);
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

program
  .command("upgrade")
  .description("Pull latest AnkerCode and rebuild. Use --scanners to also update Syft, Trivy, Gitleaks, Pandoc.")
  .option("--scanners", "Also update all scanner dependencies")
  .action(async (opts: { scanners: boolean }) => {
    await runUpgrade(opts);
  });

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error((err as Error).message);
  process.exit(1);
});
