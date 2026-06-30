import { z } from "zod";

export const SbomRefSchema = z.object({
  format: z.enum(["CycloneDX", "SPDX"]),
  path: z.string(),
  hash: z.string(),
});

export const FindingSchema = z.object({
  id: z.string(),
  type: z.enum(["vulnerability", "license", "secret"]),
  severity: z.enum(["critical", "high", "medium", "low", "info"]),
  package: z
    .object({
      name: z.string(),
      version: z.string(),
      ecosystem: z.string(),
    })
    .optional(),
  scope: z.enum(["production", "development", "unknown"]),
  cveId: z.string().optional(),
  fixAvailable: z.boolean().optional(),
  recommendedAction: z.string().optional(),
  license: z.string().optional(),
  source: z.object({
    scanner: z.string(),
    ruleId: z.string().optional(),
    manifest: z.string().optional(),
  }),
  status: z.enum(["open", "triaged", "accepted", "fixed"]),
});

export const ScanRunSchema = z.object({
  id: z.string(),
  project: z.string(),
  commitSha: z.string().optional(),
  branch: z.string().optional(),
  scannerVersions: z.record(z.string()),
  createdAt: z.string(),
  sbomRef: SbomRefSchema.optional(),
  findings: z.array(FindingSchema),
});

export const VexStatementSchema = z.object({
  findingId: z.string(),
  status: z.enum(["not_affected", "affected", "fixed", "under_investigation"]),
  justification: z.string().optional(),
  statement: z.string().optional(),
  author: z.string(),
  timestamp: z.string(),
});

export const RiskAcceptanceSchema = z.object({
  findingId: z.string(),
  reason: z.string(),
  acceptedBy: z.string(),
  expiresAt: z.string().optional(),
});

export const AuditEventSchema = z.object({
  id: z.string(),
  actor: z.string(),
  action: z.string(),
  metadata: z.record(z.unknown()),
  createdAt: z.string(),
});

export const ReportSchema = z.object({
  id: z.string(),
  project: z.string(),
  type: z.enum(["readiness", "evidence", "sbom-quality"]),
  storagePath: z.string(),
  createdAt: z.string(),
});

export type SbomRef = z.infer<typeof SbomRefSchema>;
export type Finding = z.infer<typeof FindingSchema>;
export type ScanRun = z.infer<typeof ScanRunSchema>;
export type VexStatement = z.infer<typeof VexStatementSchema>;
export type RiskAcceptance = z.infer<typeof RiskAcceptanceSchema>;
export type AuditEvent = z.infer<typeof AuditEventSchema>;
export type Report = z.infer<typeof ReportSchema>;
