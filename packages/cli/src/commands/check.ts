import { runScan } from "./scan.js";
import { runReport } from "./report.js";

export interface CheckOptions {
  project?: string;
  pdf: boolean;
  html: boolean;
  docx: boolean;
}

export async function runCheck(targetPath: string, opts: CheckOptions): Promise<void> {
  // Default to all formats if none specified
  const formats = {
    pdf:  opts.pdf  || (!opts.pdf && !opts.html && !opts.docx),
    html: opts.html || (!opts.pdf && !opts.html && !opts.docx),
    docx: opts.docx || (!opts.pdf && !opts.html && !opts.docx),
  };

  const scanOpts: Parameters<typeof runScan>[1] = {};
  if (opts.project !== undefined) scanOpts.project = opts.project;
  await runScan(targetPath, scanOpts);
  await runReport(targetPath, { ...formats });
}
