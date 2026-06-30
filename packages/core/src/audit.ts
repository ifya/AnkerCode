import { appendFileSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import type { AuditEvent } from "./schemas.js";

export function makeAuditEvent(params: Omit<AuditEvent, "id" | "createdAt">): AuditEvent {
  return {
    id: randomUUID(),
    actor: params.actor,
    action: params.action,
    metadata: params.metadata,
    createdAt: new Date().toISOString(),
  };
}

export function emitAuditEvent(
  params: Omit<AuditEvent, "id" | "createdAt">,
  outputDir: string,
): AuditEvent {
  const event = makeAuditEvent(params);
  appendFileSync(join(outputDir, "audit.jsonl"), JSON.stringify(event) + "\n", "utf8");
  return event;
}
