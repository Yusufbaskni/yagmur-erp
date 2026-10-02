import { PageHeader } from "@/components/erp";
import { PartyForm } from "@/components/forms";
import { createPartyAction } from "@/server/actions";

export const metadata = { title: "Yeni cari" };

export default function NewPartyPage() {
  return (
    <div>
      <PageHeader title="Yeni cari" description="Müşteri veya tedarikçi kartı açın." />
      <PartyForm action={createPartyAction} />
    </div>
  );
}
