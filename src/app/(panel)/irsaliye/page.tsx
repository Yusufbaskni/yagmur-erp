import Link from "next/link";
import { EmptyState, LinkButton, PageHeader, Panel, StatusBadge } from "@/components/erp";
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
import { listDeliveryNotes } from "@/server/queries";

export const metadata = { title: "İrsaliyeler" };

export default async function DeliveryNotesPage() {
  const notes = await listDeliveryNotes();
  return (
    <div>
      <PageHeader
        title="İrsaliyeler"
        description="Sevk ve mal kabul irsaliyeleri."
        actions={<LinkButton href="/irsaliye/yeni">Yeni irsaliye</LinkButton>}
      />
      {notes.length === 0 ? (
        <EmptyState title="İrsaliye yok." action={<LinkButton href="/irsaliye/yeni">Yeni irsaliye</LinkButton>} />
      ) : (
        <Panel>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No</TableHead>
                <TableHead>Yön</TableHead>
                <TableHead>Cari</TableHead>
                <TableHead>Depo</TableHead>
                <TableHead>Durum</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {notes.map((note) => (
                <TableRow key={note.id}>
                  <TableCell>
                    <Link href={`/irsaliye/${note.id}`} className="font-medium text-primary">
                      {note.number}
                    </Link>
                    <p className="text-xs text-muted-foreground">{formatDate(note.date)}</p>
                  </TableCell>
                  <TableCell>{deliveryDirectionLabel[note.direction]}</TableCell>
                  <TableCell>{note.party.name}</TableCell>
                  <TableCell>{note.warehouse?.code ?? "—"}</TableCell>
                  <TableCell>
                    <StatusBadge code={note.status} label={deliveryStatusLabel[note.status]} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      )}
    </div>
  );
}
