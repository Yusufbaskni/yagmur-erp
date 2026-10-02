import type { Db } from "@/server/db";

export async function writeAudit(
  tx: Db,
  input: {
    companyId: string;
    userId?: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    summary: string;
    detail?: string | null;
  },
) {
  await tx.auditLog.create({
    data: {
      companyId: input.companyId,
      userId: input.userId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      summary: input.summary,
      detail: input.detail ?? null,
    },
  });
}
