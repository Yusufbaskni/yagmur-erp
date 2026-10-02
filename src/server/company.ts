import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { UserRole } from "@prisma/client";
import { SESSION_COOKIE } from "@/lib/session";
import { db } from "@/server/db";
import type { Actor } from "@/server/ledger";
import { requireUser } from "@/server/auth";

export const COMPANY_COOKIE = "yagmur_company";

export async function listUserCompanies(userId: string) {
  return db().userCompany.findMany({
    where: { userId },
    include: { company: true },
    orderBy: { company: { name: "asc" } },
  });
}

export async function resolveActor(): Promise<Actor & { name: string; email: string; role: UserRole }> {
  const user = await requireUser();
  const memberships = await listUserCompanies(user.sub);
  if (memberships.length === 0) {
    const jar = await cookies();
    jar.delete(SESSION_COOKIE);
    jar.delete(COMPANY_COOKIE);
    redirect("/giris?hata=" + encodeURIComponent("Şirket üyeliğiniz yok. Yöneticiye başvurun."));
  }
  const jar = await cookies();
  const preferred = jar.get(COMPANY_COOKIE)?.value;
  const membership =
    memberships.find((m) => m.companyId === preferred) ?? memberships[0];
  return {
    userId: user.sub,
    companyId: membership.companyId,
    role: membership.role,
    name: user.name,
    email: user.email,
  };
}

export async function getActiveCompany() {
  const actor = await resolveActor();
  const company = await db().company.findUniqueOrThrow({
    where: { id: actor.companyId },
  });
  const memberships = await listUserCompanies(actor.userId!);
  return { actor, company, memberships };
}
