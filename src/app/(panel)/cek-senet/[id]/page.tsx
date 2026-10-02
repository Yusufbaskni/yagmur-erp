import { notFound } from "next/navigation";
import { ErrorNote, Money, PageHeader, StatusBadge } from "@/components/erp";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { checkNoteStatusLabel } from "@/lib/labels";
import { updateCheckStatusAction } from "@/server/actions";
import { getCheckNote } from "@/server/queries";

export const metadata = { title: "Çek-senet" };

export default async function CheckNotePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ hata?: string }>;
}) {
  const { id } = await params;
  const { hata } = await searchParams;
  const note = await getCheckNote(id);
  if (!note) notFound();
  return (
    <div>
      <PageHeader
        eyebrow={note.kind === "CHECK" ? "Çek" : "Senet"}
        title={note.number}
        description={`${formatDate(note.dueDate)} · ${note.bankName || "Banka yok"}`}
        actions={<StatusBadge code={note.status} label={checkNoteStatusLabel[note.status]} />}
      />
      <ErrorNote message={hata} />
      <div className="mb-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <Info label="Tutar" value={<Money value={note.amount} />} />
        <Info label="Cari" value={note.party ? `${note.party.code} · ${note.party.name}` : "—"} />
        <Info
          label="Hesap"
          value={note.moneyAccount ? `${note.moneyAccount.code} · ${note.moneyAccount.name}` : "—"}
        />
        <Info label="Seri no" value={note.serialNo || "—"} />
      </div>
      {note.status === "PORTFOLIO" ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {(["COLLECTED", "ENDORSED", "BOUNCED"] as const).map((status) => (
            <form key={status} action={updateCheckStatusAction}>
              <input type="hidden" name="id" value={note.id} />
              <input type="hidden" name="status" value={status} />
              <Button type="submit" size="sm" variant={status === "BOUNCED" ? "outline" : "default"}>
                {checkNoteStatusLabel[status]}
              </Button>
            </form>
          ))}
        </div>
      ) : null}
      {note.notes ? <p className="text-sm text-muted-foreground">{note.notes}</p> : null}
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-card px-3 py-2 ring-1 ring-foreground/10">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
