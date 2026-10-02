import Link from "next/link";
import { notFound } from "next/navigation";
import { ErrorNote, PageHeader, Panel, StatusBadge } from "@/components/erp";
import { PostButton } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { eInvoiceStatusLabel } from "@/lib/labels";
import { respondEInvoiceAction, sendEInvoiceAction } from "@/server/actions";
import { getEInvoice } from "@/server/queries";

export const metadata = { title: "e-Fatura" };

export default async function EInvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ hata?: string }>;
}) {
  const { id } = await params;
  const { hata } = await searchParams;
  const doc = await getEInvoice(id);
  if (!doc) notFound();
  return (
    <div>
      <PageHeader
        eyebrow="e-Fatura"
        title={doc.number}
        description="Sandbox — canlı GİB bağlantısı yok."
        actions={<StatusBadge code={doc.status} label={eInvoiceStatusLabel[doc.status]} />}
      />
      <ErrorNote message={hata} />
      <div className="mb-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <Info label="Yön" value={doc.direction === "OUTGOING" ? "Giden" : "Gelen"} />
        <Info
          label="Satış faturası"
          value={doc.salesInvoice?.number ?? "—"}
          href={doc.salesInvoiceId ? `/satis/faturalar/${doc.salesInvoiceId}` : undefined}
        />
        <Info label="UUID" value={doc.uuid ?? "—"} />
        <Info label="Oluşturma" value={formatDate(doc.createdAt)} />
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {doc.status === "DRAFT" ? (
          <PostButton action={sendEInvoiceAction} id={doc.id} label="Sandbox gönder" />
        ) : null}
        {doc.status === "SENT" ? (
          <>
            <form action={respondEInvoiceAction}>
              <input type="hidden" name="id" value={doc.id} />
              <input type="hidden" name="accept" value="1" />
              <Button type="submit" size="sm">
                Kabul simüle et
              </Button>
            </form>
            <form action={respondEInvoiceAction}>
              <input type="hidden" name="id" value={doc.id} />
              <input type="hidden" name="accept" value="0" />
              <Button type="submit" size="sm" variant="outline">
                Red simüle et
              </Button>
            </form>
          </>
        ) : null}
      </div>
      {doc.responseNote ? (
        <p className="mb-4 text-sm text-muted-foreground">{doc.responseNote}</p>
      ) : null}
      {doc.xmlContent ? (
        <Panel className="p-3">
          <h2 className="mb-2 text-sm font-semibold">UBL XML</h2>
          <pre className="max-h-96 overflow-auto rounded-lg bg-muted/50 p-3 text-xs whitespace-pre-wrap">
            {doc.xmlContent}
          </pre>
        </Panel>
      ) : null}
    </div>
  );
}

function Info({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="rounded-xl bg-card px-3 py-2 ring-1 ring-foreground/10">
      <p className="text-xs text-muted-foreground">{label}</p>
      {href ? (
        <Link href={href} className="font-medium text-primary">
          {value}
        </Link>
      ) : (
        <p className="font-medium break-all">{value}</p>
      )}
    </div>
  );
}
