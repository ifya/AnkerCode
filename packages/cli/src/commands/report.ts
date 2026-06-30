import { existsSync } from "fs";
import { resolve, join } from "path";
import type { ReportFormat } from "@ankercode/report";
import { renderReport } from "@ankercode/report";

function formatDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface ReportOptions {
  html: boolean;
  pdf: boolean;
  docx: boolean;
  output?: string;
}

export async function runReport(targetPath: string, opts: ReportOptions): Promise<void> {
  const target = resolve(targetPath);
  const findingsPath = join(target, "ankercode", "findings.json");

  if (!existsSync(findingsPath)) {
    console.error(`Error: findings.json not found at ${findingsPath}`);
    console.error("Run `ankercode scan` first.");
    process.exit(1);
  }

  const formats: ReportFormat[] = [];
  if (opts.pdf) formats.push("pdf");
  if (opts.html) formats.push("html");
  if (opts.docx) formats.push("docx");
  if (formats.length === 0) formats.push("pdf");

  const date = formatDate();

  console.log(`\nAnkerCode report — ${target}`);

  for (const format of formats) {
    const ext = format;
    const outputPath =
      opts.output ?? join(target, "ankercode", `report-${date}.${ext}`);

    process.stdout.write(`  Generating ${format.toUpperCase()}...`);
    try {
      await renderReport(findingsPath, format, outputPath);
      console.log(` → ${outputPath}`);
    } catch (err: unknown) {
      const msg = (err as Error).message ?? String(err);
      console.log(" FAILED");
      if (format === "pdf" && msg.includes("wkhtmltopdf")) {
        console.error("  PDF requires wkhtmltopdf: sudo apt install wkhtmltopdf");
      } else {
        console.error(`  ${msg}`);
      }
    }
  }

  console.log();
}
