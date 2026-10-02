import { notFound } from "next/navigation";
import { PageHeader } from "@/components/erp";
import { PartyForm } from "@/components/forms";
import { updatePartyAction } from "@/server/actions";
import { db } from "@/server/db";

export const metadata = { title: "Cari düzenle" };

export default async function EditPartyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const party = await db().party.findUnique({ where: { id } });
  if (!party) notFound();
  return (
    <div>
      <PageHeader eyebrow={party.code} title="Cariyi düzenle" />
      <PartyForm action={updatePartyAction} initial={party} />
    </div>
  );
}
