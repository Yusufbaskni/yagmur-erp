import Link from "next/link";
import { EmptyState, LinkButton, Money, PageHeader, Panel, StatusBadge } from "@/components/erp";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { checkNoteStatusLabel } from "@/lib/labels";
import { listCheckNotes } from "@/server/queries";

export const metadata = { title: "Çek-senet" };

export default async function CheckNotesPage() {
  const notes = await listCheckNotes();
  return (
    <div>
      <PageHeader
        title="Çek-senet"
        description="Portföydeki çek ve senetler."
        actions={<LinkButton href="/cek-senet/yeni">Yeni kayıt</LinkButton>}
      />
      {notes.length === 0 ? (
        <EmptyState title="Çek/senet yok." action={<LinkButton href="/cek-senet/yeni">Yeni kayıt</LinkButton>} />
      ) : (
        <Panel>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No</TableHead>
                <TableHead>Tür</TableHead>
                <TableHead>Cari</TableHead>
                <TableHead>Vade</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead className="text-right">Tutar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {notes.map((note) => (
                <TableRow key={note.id}>
                  <TableCell>
                    <Link href={`/cek-senet/${note.id}`} className="font-medium text-primary">
                      {note.number}
                    </Link>
                  </TableCell>
                  <TableCell>{note.kind === "CHECK" ? "Çek" : "Senet"}</TableCell>
                  <TableCell>{note.party?.name ?? "—"}</TableCell>
                  <TableCell>{formatDate(note.dueDate)}</TableCell>
                  <TableCell>
                    <StatusBadge code={note.status} label={checkNoteStatusLabel[note.status]} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Money value={note.amount} />
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
