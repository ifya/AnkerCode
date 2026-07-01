import { existsSync, readFileSync } from "fs";
import { resolve, join } from "path";
import { readConfig } from "../config.js";
import type { ScanRun, PolicyResult } from "@ankercode/core";
import { PolicyResultSchema } from "@ankercode/core";

export interface UploadOptions {
  org:     string;
  project: string;
  repoUrl?: string;
  url?:    string;
  key?:    string;
}

export async function runUpload(targetPath: string, opts: UploadOptions): Promise<void> {
  const config     = readConfig();
  const cloudUrl   = opts.url    ?? config.url    ?? "https://cloud.ankercode.io";
  const apiKey     = opts.key    ?? config.apiKey;
  const outputDir  = join(resolve(targetPath), "ankercode");
  const findingsFile = join(outputDir, "findings.json");

  // ── Pre-flight checks ─────────────────────────────────────────
  if (!apiKey) {
    console.log("\x1b[33m○\x1b[0m  Upload übersprungen — kein API-Key konfiguriert.");
    console.log("   Das Dashboard und der Cloud-Upload erfordern eine AnkerCode-Lizenz.");
    console.log("   Mehr Informationen: \x1b[36mhttps://ankercode.io\x1b[0m");
    console.log("   Zum Einrichten: \x1b[2mankercode config set key ank_live_...\x1b[0m");
    return; // soft exit — scan artifacts are still on disk, CI stays green
  }

  if (!existsSync(findingsFile)) {
    console.error(`\x1b[31m✗\x1b[0m findings.json nicht gefunden in ${outputDir}`);
    console.error("  Führen Sie zuerst \x1b[33mankercode scan\x1b[0m aus.");
    process.exit(1);
  }

  let scanRun: ScanRun;
  try {
    scanRun = JSON.parse(readFileSync(findingsFile, "utf8")) as ScanRun;
  } catch {
    console.error("\x1b[31m✗\x1b[0m findings.json konnte nicht gelesen werden.");
    process.exit(1);
  }

  // Include policy result if present alongside findings.json
  let policyResult: PolicyResult | undefined;
  const policyResultFile = join(outputDir, "policy-result.json");
  if (existsSync(policyResultFile)) {
    const parsed = PolicyResultSchema.safeParse(
      JSON.parse(readFileSync(policyResultFile, "utf8")),
    );
    if (parsed.success) policyResult = parsed.data;
  }

  console.log(`\x1b[36m▲\x1b[0m AnkerCode Upload`);
  console.log(`  Ziel:    \x1b[2m${cloudUrl}\x1b[0m`);
  console.log(`  Org:     \x1b[33m${opts.org}\x1b[0m`);
  console.log(`  Projekt: \x1b[33m${opts.project}\x1b[0m`);
  console.log(`  Befunde: ${scanRun.findings.length}`);
  if (policyResult !== undefined) {
    const pStatus = policyResult.passed ? "\x1b[32m✓ bestanden\x1b[0m" : "\x1b[31m✗ verletzt\x1b[0m";
    console.log(`  Policy:  ${pStatus}`);
  }
  console.log();

  // ── POST to cloud API ─────────────────────────────────────────
  const endpoint = `${cloudUrl.replace(/\/$/, "")}/api/v1/upload`;

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "User-Agent":    `ankercode-cli/${getCliVersion()}`,
      },
      body: JSON.stringify({
        org:         opts.org,
        project:     opts.project,
        repoUrl:     opts.repoUrl,
        projectName: opts.project,
        scanRun,
        ...(policyResult !== undefined ? { policyResult } : {}),
      }),
    });
  } catch (err: unknown) {
    console.error(`\x1b[31m✗\x1b[0m Verbindung fehlgeschlagen: ${cloudUrl}`);
    console.error(`  ${(err as Error).message}`);
    process.exit(1);
  }

  let body: { ok?: boolean; scanRunId?: string; url?: string; error?: string };
  try {
    body = await res.json();
  } catch {
    body = {};
  }

  if (!res.ok) {
    console.error(`\x1b[31m✗\x1b[0m Upload fehlgeschlagen (HTTP ${res.status})`);
    if (body.error) console.error(`  ${body.error}`);
    process.exit(1);
  }

  console.log(`\x1b[32m✓\x1b[0m Upload erfolgreich`);
  if (body.scanRunId) console.log(`  Scan-ID:  \x1b[2m${body.scanRunId}\x1b[0m`);
  if (body.url)       console.log(`  Dashboard: \x1b[36m${body.url}\x1b[0m`);
}

function getCliVersion(): string {
  try {
    const pkg = JSON.parse(
      readFileSync(new URL("../../package.json", import.meta.url).pathname, "utf8")
    );
    return pkg.version ?? "0.1.0";
  } catch {
    return "0.1.0";
  }
}
