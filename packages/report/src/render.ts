import { execFile } from "child_process";
import { promisify } from "util";
import { writeFileSync, readFileSync, existsSync, unlinkSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import type { ScanRun, PolicyResult } from "@ankercode/core";
import { PolicyResultSchema } from "@ankercode/core";
import { renderReportMarkdown } from "./template.js";
import { reportCss } from "./css.js";
import { loadDecisions } from "./decisions.js";

const exec = promisify(execFile);

export type ReportFormat = "html" | "pdf" | "docx";

function pandocEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    PATH: `${join(homedir(), ".local", "bin")}:/usr/local/bin:${process.env["PATH"] ?? ""}`,
  };
}

export async function renderReport(
  findingsPath: string,
  format: ReportFormat,
  outputPath: string,
): Promise<void> {
  const scanRun: ScanRun = JSON.parse(readFileSync(findingsPath, "utf8"));

  // decisions and policy-result live alongside findings.json
  const outputDir   = join(findingsPath, "..");
  const projectRoot = join(outputDir, "..");
  const decisions   = loadDecisions(projectRoot);

  // Pick up policy result written by `ankercode policy check` if present
  const policyResultPath = join(outputDir, "policy-result.json");
  let policyResult: PolicyResult | undefined;
  if (existsSync(policyResultPath)) {
    const parsed = PolicyResultSchema.safeParse(
      JSON.parse(readFileSync(policyResultPath, "utf8")),
    );
    if (parsed.success) policyResult = parsed.data;
  }

  const markdown = renderReportMarkdown(scanRun, decisions, policyResult);

  const mdTmp = join(tmpdir(), `ankercode-report-${randomUUID()}.md`);
  const cssTmp = join(tmpdir(), `ankercode-report-${randomUUID()}.css`);

  writeFileSync(mdTmp, markdown, "utf8");
  writeFileSync(cssTmp, reportCss, "utf8");

  const env = pandocEnv();

  try {
    if (format === "html") {
      await exec(
        "pandoc",
        [
          mdTmp,
          "--from", "markdown",
          "--to", "html5",
          "--standalone",
          "--embed-resources",
          "--css", cssTmp,
          "--output", outputPath,
          "--metadata", "lang=de",
        ],
        { env },
      );
    } else if (format === "pdf") {
      await exec(
        "pandoc",
        [
          mdTmp,
          "--from", "markdown",
          "--to", "html5",
          "--pdf-engine", "wkhtmltopdf",
          "--css", cssTmp,
          "--output", outputPath,
          "--metadata", "lang=de",
          "-V", "margin-top=20mm",
          "-V", "margin-right=18mm",
          "-V", "margin-bottom=20mm",
          "-V", "margin-left=18mm",
        ],
        { env },
      );
    } else if (format === "docx") {
      await exec(
        "pandoc",
        [
          mdTmp,
          "--from", "markdown",
          "--to", "docx",
          "--output", outputPath,
          "--metadata", "lang=de",
        ],
        { env },
      );
    }
  } finally {
    if (existsSync(mdTmp)) unlinkSync(mdTmp);
    if (existsSync(cssTmp)) unlinkSync(cssTmp);
  }
}
