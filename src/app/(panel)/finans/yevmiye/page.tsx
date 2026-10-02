import { EmptyState, Money, PageHeader, Panel } from "@/components/erp";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { listJournalEntries } from "@/server/queries";

export const metadata = { title: "Yevmiye" };

export default async function JournalPage() {
  const entries = await listJournalEntries();
  return (
    <div>
      <PageHeader title="Yevmiye" description="Son muhasebe yevmiye kayıtları." />
      {entries.length === 0 ? (
        <EmptyState title="Yevmiye kaydı yok." />
      ) : (
        <div className="grid gap-4">
          {entries.map((entry) => (
            <Panel key={entry.id}>
              <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <div>
                  <p className="text-sm font-semibold">{entry.number}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(entry.date)}
                    {entry.memo ? ` · ${entry.memo}` : ""}
                    {entry.source ? ` · ${entry.source}` : ""}
                  </p>
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Hesap</TableHead>
                    <TableHead className="text-right">Borç</TableHead>
                    <TableHead className="text-right">Alacak</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entry.lines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell>
                        {line.account.code} · {line.account.name}
                        {line.memo ? (
                          <p className="text-xs text-muted-foreground">{line.memo}</p>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right">
                        {line.debit ? <Money value={line.debit} /> : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {line.credit ? <Money value={line.credit} /> : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
