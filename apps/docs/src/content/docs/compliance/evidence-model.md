---
title: Evidence Model
description: The data model that powers every AnkerCode artifact.
---

AnkerCode's evidence model is the single durable asset of the project. It is defined once in `@ankercode/core` as Zod schemas + inferred TypeScript types. Everything — the CLI, the report engine, and future dashboard — reads and writes to this model.

The model is open-format: it maps to CycloneDX, OpenVEX, and SARIF so artifacts are portable to other tools.

## ScanRun

The root artifact produced by `ankercode scan`.

```ts
type ScanRun = {
  id: string;
  project: string;
  commitSha?: string;
  branch?: string;
  scannerVersions: Record<string, string>;  // { syft: "1.46.0", trivy: "0.72.0", "trivy-db": "2026-07-02", gitleaks: "8.30.1" }
  createdAt: string;                         // ISO 8601
  sbomRef?: SbomRef;
  findings: Finding[];
};
```

## Finding

One normalized finding from any scanner.

```ts
type Finding = {
  id: string;           // stable SHA-256 hash of (type, package, version, ruleId)
  type: "vulnerability" | "license" | "secret";
  severity: "critical" | "high" | "medium" | "low" | "info";
  package?: {
    name: string;
    version: string;
    ecosystem: string;
  };
  scope: "production" | "development" | "unknown";
  // vulnerability-specific
  cveId?: string;
  fixAvailable?: boolean;
  recommendedAction?: string;   // e.g. "Upgrade to 1.2.8"
  // license-specific
  license?: string;              // SPDX identifier
  // provenance
  source: {
    scanner: string;
    ruleId?: string;
    manifest?: string;           // path to the manifest file
  };
  status: "open" | "triaged" | "accepted" | "fixed";
};
```

## SbomRef

A pointer to the generated SBOM file with a hash for integrity verification.

```ts
type SbomRef = {
  format: "CycloneDX" | "SPDX";
  path: string;
  hash: string;   // SHA-256
};
```

## VexStatement

Documents your analysis of a specific CVE. Maps to [OpenVEX](https://github.com/openvex/spec).

```ts
type VexStatement = {
  findingId: string;
  status: "not_affected" | "affected" | "fixed" | "under_investigation";
  justification?: string;   // OpenVEX justification enum (when status = not_affected)
  statement?: string;       // human prose (AI may draft, human signs)
  author: string;           // required — a human
  timestamp: string;
};
```

## RiskAcceptance

Documents a conscious decision to accept a risk with a stated reason and expiry.

```ts
type RiskAcceptance = {
  findingId: string;
  reason: string;
  acceptedBy: string;   // required — a human
  expiresAt?: string;   // ISO date
};
```

## AuditEvent

An append-only record of every significant action. Stored in `audit.jsonl`.

```ts
type AuditEvent = {
  id: string;
  actor: string;
  action: string;   // "scan.run" | "finding.accept" | "report.generate" | ...
  metadata: Record<string, unknown>;
  createdAt: string;
};
```

## Finding ID stability

The `id` on every `Finding` is a stable 16-character hex hash of:

```
SHA-256(type + "\x00" + packageName + "\x00" + packageVersion + "\x00" + ruleId)
```

The same dependency with the same CVE in the same repo will always get the same ID across scan runs. This is what makes VEX statements and risk acceptances in `ankercode.decisions.yaml` durable — they reference a stable ID, not a row number.

## Open format mapping

| AnkerCode artifact | Open standard |
|---|---|
| `sbom.cyclonedx.json` | CycloneDX 1.6 |
| VEX statements | OpenVEX |
| Scanner findings export | SARIF (`ankercode scan --format sarif`) |
