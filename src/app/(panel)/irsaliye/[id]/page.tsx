import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, Panel, Qty, StatusBadge } from "@/components/erp";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { deliveryDirectionLabel, deliveryStatusLabel } from "@/lib/labels";
import { getDeliveryNote } from "@/server/queries";

export const metadata = { title: "İrsaliye" };

export default async function DeliveryNotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const note = await getDeliveryNote(id);
  if (!note) notFound();
  return (
    <div>
      <PageHeader
        eyebrow="İrsaliye"
        title={note.number}
        description={`${deliveryDirectionLabel[note.direction]} · ${formatDate(note.date)}`}
        actions={<StatusBadge code={note.status} label={deliveryStatusLabel[note.status]} />}
      />
      <div className="mb-4 grid gap-3 text-sm sm:grid-cols-3">
        <Info
          label="Cari"
          value={`${note.party.code} · ${note.party.name}`}
          href={`/cariler/${note.partyId}`}
        />
        <Info label="Depo" value={note.warehouse ? `${note.warehouse.code} · ${note.warehouse.name}` : "—"} />
        <Info label="Durum" value={deliveryStatusLabel[note.status]} />
      </div>
      <Panel>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Ürün</TableHead>
              <TableHead className="text-right">Miktar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {note.lines.map((line) => (
              <TableRow key={line.id}>
                <TableCell className="font-medium">{line.product.sku}</TableCell>
                <TableCell>{line.product.name}</TableCell>
                <TableCell className="text-right">
                  <Qty value={line.quantity} unit={line.product.unit} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
      {note.notes ? <p className="mt-3 text-sm text-muted-foreground">{note.notes}</p> : null}
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
        <p className="font-medium">{value}</p>
      )}
    </div>
  );
}
