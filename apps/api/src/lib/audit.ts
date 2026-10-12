import { prisma } from "./prisma.js";

interface AuditInput {
  shopId?: string | null;
  staffId?: string | null;
  action: string;
  entity?: string;
  entityId?: string;
  ip?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Best-effort audit logging. Never blocks or throws for the caller.
 */
export function recordAudit(input: AuditInput): void {
  prisma.auditLog
    .create({
      data: {
        shopId: input.shopId ?? null,
        staffId: input.staffId ?? null,
        action: input.action,
        entity: input.entity ?? null,
        entityId: input.entityId ?? null,
        ip: input.ip ?? null,
        metadata: (input.metadata ?? undefined) as never,
      },
    })
    .catch(() => {
      // ignore audit failures
    });
}
