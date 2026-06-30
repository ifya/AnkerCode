import { createHash } from "crypto";

export function makeFindingId(parts: {
  type: "vulnerability" | "license" | "secret";
  packageName?: string;
  packageVersion?: string;
  ruleId?: string;
}): string {
  // Null byte as delimiter — cannot appear in any of these fields.
  const canonical = [
    parts.type,
    parts.packageName ?? "",
    parts.packageVersion ?? "",
    parts.ruleId ?? "",
  ].join("\x00");
  return createHash("sha256").update(canonical).digest("hex").slice(0, 16);
}
