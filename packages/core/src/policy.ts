import { z } from "zod";

const SeverityEnum      = z.enum(["critical", "high", "medium", "low", "info"]);
const ScopeEnum         = z.enum(["production", "development", "unknown"]);
const PolicyActionEnum  = z.enum(["block", "warn", "ignore"]);

export const VulnRuleSchema = z.object({
  id:             z.string(),
  severity:       z.array(SeverityEnum).min(1),
  scope:          z.array(ScopeEnum).optional(),   // undefined = all scopes
  maxUnfixedDays: z.number().int().positive().optional(),
  action:         PolicyActionEnum,
});

export const LicensePolicySchema = z.object({
  deny:  z.array(z.string()).default([]),
  warn:  z.array(z.string()).default([]),
  scope: ScopeEnum.optional(),                      // undefined = all scopes
});

export const SecretPolicySchema = z.object({
  action: PolicyActionEnum.default("block"),
});

export const PolicyConfigSchema = z.object({
  version:         z.literal(1),
  vulnerabilities: z.array(VulnRuleSchema).default([]),
  licenses:        LicensePolicySchema.optional(),
  secrets:         SecretPolicySchema.optional(),
});

export const PolicyViolationSchema = z.object({
  ruleId:    z.string(),
  findingId: z.string(),
  action:    PolicyActionEnum,
  message:   z.string(),
});

export const PolicyResultSchema = z.object({
  passed:      z.boolean(),
  violations:  z.array(PolicyViolationSchema),
  warnings:    z.array(PolicyViolationSchema),
  policyFile:  z.string(),
  evaluatedAt: z.string(),
});

export type VulnRule       = z.infer<typeof VulnRuleSchema>;
export type LicensePolicy  = z.infer<typeof LicensePolicySchema>;
export type SecretPolicy   = z.infer<typeof SecretPolicySchema>;
export type PolicyConfig   = z.infer<typeof PolicyConfigSchema>;
export type PolicyViolation = z.infer<typeof PolicyViolationSchema>;
export type PolicyResult   = z.infer<typeof PolicyResultSchema>;
