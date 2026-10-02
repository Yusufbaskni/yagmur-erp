import { EmptyState, PageHeader, Panel, Qty } from "@/components/erp";
import { TransferForm } from "@/components/transfer-form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { formOptions, listTransfers } from "@/server/queries";

export const metadata = { title: "Depo transferleri" };

export default async function TransfersPage() {
  const [transfers, opts] = await Promise.all([listTransfers(), formOptions()]);
  return (
    <div>
      <PageHeader title="Depo transferleri" description="Depolar arası stok taşıma." />
      <Panel className="mb-4 p-3">
        <h2 className="mb-3 text-sm font-semibold">Yeni transfer</h2>
        <TransferForm warehouses={opts.warehouses} products={opts.products} />
      </Panel>
      {transfers.length === 0 ? (
        <EmptyState title="Transfer yok." />
      ) : (
        <Panel>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No</TableHead>
                <TableHead>Tarih</TableHead>
                <TableHead>Kaynak</TableHead>
                <TableHead>Hedef</TableHead>
                <TableHead className="text-right">Satır</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transfers.map((tr) => (
                <TableRow key={tr.id}>
                  <TableCell className="font-medium">{tr.number}</TableCell>
                  <TableCell>{formatDate(tr.date)}</TableCell>
                  <TableCell>
                    {tr.fromWarehouse.code} · {tr.fromWarehouse.name}
                  </TableCell>
                  <TableCell>
                    {tr.toWarehouse.code} · {tr.toWarehouse.name}
                  </TableCell>
                  <TableCell className="text-right">
                    {tr.lines.length} ·{" "}
                    <Qty value={tr.lines.reduce((s, l) => s + l.quantity, 0)} />
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
