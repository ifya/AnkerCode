import { readFileSync } from "fs";
import { createHash } from "crypto";
import { request as httpsRequest } from "https";
import type { Finding } from "@ankercode/core";
import { makeFindingId } from "@ankercode/core";

// ── OSV API types ────────────────────────────────────────────────────────────

interface OsvQuery {
  package: { name: string; ecosystem: string };
  version: string;
}

interface OsvVuln {
  id: string;
  aliases?: string[];
  summary?: string;
  severity?: Array<{ type: string; score: string }>;
  database_specific?: { severity?: string; cvss?: string };
  affected?: Array<{
    package?: { name: string; ecosystem: string };
    ranges?: Array<{ type: string; events?: Array<{ introduced?: string; fixed?: string }> }>;
  }>;
}

interface OsvBatchResult {
  results: Array<{ vulns?: OsvVuln[] }>;
}

// ── Ecosystem mapping: purl prefix → OSV ecosystem ──────────────────────────

const PURL_TO_OSV: Array<[string, string]> = [
  ["pkg:pypi/",   "PyPI"],
  ["pkg:npm/",    "npm"],
  ["pkg:maven/",  "Maven"],
  ["pkg:golang/", "Go"],
  ["pkg:cargo/",  "crates.io"],
  ["pkg:gem/",    "RubyGems"],
  ["pkg:nuget/",  "NuGet"],
  ["pkg:composer/","Packagist"],
  ["pkg:hex/",    "Hex"],
  ["pkg:pub/",    "Pub"],
  ["pkg:swift/",  "SwiftURL"],
];

function purlToOsvEcosystem(purl: string): string | null {
  for (const [prefix, eco] of PURL_TO_OSV) {
    if (purl.startsWith(prefix)) return eco;
  }
  return null;
}

// Maven purls: pkg:maven/groupId/artifactId@version → name = "groupId:artifactId"
function purlToPackageName(purl: string, fallbackName: string): string {
  if (purl.startsWith("pkg:maven/")) {
    const mavenPath = purl.slice("pkg:maven/".length).split("@")[0];
    if (!mavenPath) return fallbackName;
    const parts = mavenPath.split("/");
    const g = parts[0], a = parts[1];
    if (g && a) return `${g}:${a}`;
  }
  return fallbackName;
}

// ── CycloneDX SBOM parsing ───────────────────────────────────────────────────

interface CycloneDxComponent {
  name: string;
  version?: string;
  purl?: string;
}

interface CycloneDxSbom {
  components?: CycloneDxComponent[];
}

export function extractPackagesFromSbom(sbomPath: string): OsvQuery[] {
  let sbom: CycloneDxSbom;
  try {
    sbom = JSON.parse(readFileSync(sbomPath, "utf8"));
  } catch {
    return [];
  }

  const seen = new Set<string>();
  const queries: OsvQuery[] = [];

  for (const comp of sbom.components ?? []) {
    if (!comp.version || !comp.purl) continue;
    const ecosystem = purlToOsvEcosystem(comp.purl);
    if (!ecosystem) continue;
    const name = purlToPackageName(comp.purl, comp.name);
    const key = `${ecosystem}:${name}:${comp.version}`;
    if (seen.has(key)) continue;
    seen.add(key);
    queries.push({ package: { name, ecosystem }, version: comp.version });
  }

  return queries;
}

// ── HTTP helpers ─────────────────────────────────────────────────────────────

function httpsPost(url: string, body: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = httpsRequest(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          "User-Agent": "ankercode-cli/0.1",
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
        res.on("error", reject);
      },
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function httpsGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = httpsRequest(
      { hostname: u.hostname, path: u.pathname + u.search, method: "GET",
        headers: { "User-Agent": "ankercode-cli/0.1" } },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
        res.on("error", reject);
      },
    );
    req.on("error", reject);
    req.end();
  });
}

// ── OSV querybatch (1000 packages per call) ──────────────────────────────────

async function queryOsvBatch(queries: OsvQuery[]): Promise<OsvBatchResult> {
  const body = JSON.stringify({ queries });
  const raw = await httpsPost("https://api.osv.dev/v1/querybatch", body);
  return JSON.parse(raw) as OsvBatchResult;
}

// ── Fetch full OSV record for severity data ──────────────────────────────────

async function fetchOsvRecord(id: string): Promise<OsvVuln | null> {
  try {
    const raw = await httpsGet(`https://api.osv.dev/v1/vulns/${id}`);
    return JSON.parse(raw) as OsvVuln;
  } catch {
    return null;
  }
}

// ── Severity resolution ──────────────────────────────────────────────────────

function parseSeverity(vuln: OsvVuln): Finding["severity"] {
  // GitHub advisories put severity in database_specific.severity
  const dbSev = vuln.database_specific?.severity?.toUpperCase();
  if (dbSev === "CRITICAL") return "critical";
  if (dbSev === "HIGH")     return "high";
  if (dbSev === "MODERATE" || dbSev === "MEDIUM") return "medium";
  if (dbSev === "LOW")      return "low";

  // Fall back to CVSS v3 vector base score heuristic
  for (const s of vuln.severity ?? []) {
    if (s.type === "CVSS_V3" || s.type === "CVSS_V4") {
      // score field contains the vector string; extract AV/AC/PR/UI/S/C/I/A
      // rather than full CVSS math, use the /C:/I:/A: impact fields as a proxy
      const highImpact = (s.score.match(/[CIA]:H/g) ?? []).length;
      const critImpact = s.score.includes("S:C") && highImpact >= 2;
      if (critImpact) return "critical";
      if (highImpact >= 2) return "high";
      if (highImpact === 1) return "medium";
      return "low";
    }
  }

  return "medium"; // safe default — not critical enough to panic, not low enough to ignore
}

function fixedVersion(vuln: OsvVuln, pkgName: string, ecosystem: string): string | undefined {
  for (const aff of vuln.affected ?? []) {
    if (aff.package?.name !== pkgName) continue;
    for (const range of aff.ranges ?? []) {
      for (const ev of range.events ?? []) {
        if (ev.fixed) return ev.fixed;
      }
    }
  }
  return undefined;
}

// ── Main export ──────────────────────────────────────────────────────────────

export async function runOsv(
  sbomPath: string,
  existingFindings: Finding[],
): Promise<Finding[]> {
  const queries = extractPackagesFromSbom(sbomPath);
  if (queries.length === 0) return [];

  // IDs already known from Trivy (CVE or GHSA)
  const knownIds = new Set<string>();
  for (const f of existingFindings) {
    if (f.cveId) knownIds.add(f.cveId);
    if (f.source.ruleId) knownIds.add(f.source.ruleId);
  }

  // Batch query — OSV allows 1000 per call
  const CHUNK = 1000;
  const allResults: OsvBatchResult["results"] = [];
  for (let i = 0; i < queries.length; i += CHUNK) {
    const chunk = queries.slice(i, i + CHUNK);
    const batch = await queryOsvBatch(chunk);
    allResults.push(...(batch.results ?? []));
  }

  // Collect net-new findings: vulns not already in knownIds
  // The querybatch response doesn't include aliases, so we check by ID.
  // We then fetch the full record only for the new ones to get severity + aliases.
  const toFetch: Array<{ osvId: string; query: OsvQuery }> = [];

  for (let i = 0; i < allResults.length; i++) {
    const result = allResults[i]!;
    const query  = queries[i]!;
    for (const v of result.vulns ?? []) {
      if (!knownIds.has(v.id)) {
        toFetch.push({ osvId: v.id, query });
      }
    }
  }

  if (toFetch.length === 0) return [];

  // Deduplicate before fetching (same vuln may appear for multiple packages)
  const uniqueIds = new Map<string, OsvQuery>();
  for (const { osvId, query } of toFetch) {
    if (!uniqueIds.has(osvId)) uniqueIds.set(osvId, query);
  }

  // Fetch full records in parallel (cap concurrency at 8)
  const fullRecords = new Map<string, OsvVuln>();
  const ids = [...uniqueIds.keys()];
  const CONCURRENCY = 8;

  for (let i = 0; i < ids.length; i += CONCURRENCY) {
    const slice = ids.slice(i, i + CONCURRENCY);
    const fetched = await Promise.all(slice.map((id) => fetchOsvRecord(id)));
    for (let j = 0; j < slice.length; j++) {
      const rec = fetched[j];
      if (rec) fullRecords.set(slice[j]!, rec);
    }
  }

  // Build Finding objects for each net-new vuln
  const newFindings: Finding[] = [];
  const emittedIds = new Set<string>(); // dedup across packages

  for (const [osvId, query] of uniqueIds) {
    const vuln = fullRecords.get(osvId);
    if (!vuln) continue;

    const aliases = vuln.aliases ?? [];
    const allIds  = [vuln.id, ...aliases];

    // If any alias is already known, skip (Trivy already reported it differently)
    if (allIds.some((a) => knownIds.has(a))) continue;
    // Also skip if we already emitted this vuln under a different ID
    const canonKey = allIds.sort().join(",");
    if (emittedIds.has(canonKey)) continue;
    emittedIds.add(canonKey);

    const cveId   = aliases.find((a) => a.startsWith("CVE"));
    const ghsaId  = aliases.find((a) => a.startsWith("GHSA")) ?? vuln.id;
    const ruleId  = cveId ?? ghsaId;
    const severity = parseSeverity(vuln);
    const fix      = fixedVersion(vuln, query.package.name, query.package.ecosystem);

    const id = makeFindingId({
      type: "vulnerability",
      packageName: query.package.name,
      packageVersion: query.version,
      ruleId,
    });

    newFindings.push({
      id,
      type: "vulnerability",
      severity,
      package: {
        name: query.package.name,
        version: query.version,
        ecosystem: query.package.ecosystem,
      },
      scope: "unknown",
      cveId,
      fixAvailable: Boolean(fix),
      recommendedAction: fix ? `Upgrade to ${fix}` : undefined,
      source: {
        scanner: "osv",
        ruleId: ghsaId, // primary OSV/GHSA id
      },
      status: "open",
    });
  }

  return newFindings;
}
