import { AppShell } from "@/components/shell";
import { roleLabel } from "@/lib/labels";
import { getActiveCompany } from "@/server/company";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const { actor, company, memberships } = await getActiveCompany();
  return (
    <AppShell
      user={{ name: actor.name, email: actor.email }}
      company={{ id: company.id, name: company.name, shortName: company.shortName }}
      companies={memberships.map((m) => ({ id: m.company.id, name: m.company.name }))}
      roleLabel={roleLabel[actor.role]}
    >
      {children}
    </AppShell>
  );
}
