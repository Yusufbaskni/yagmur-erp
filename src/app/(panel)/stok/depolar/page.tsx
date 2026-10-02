import { EmptyState, PageHeader, Panel, Qty } from "@/components/erp";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listWarehouses } from "@/server/queries";

export const metadata = { title: "Depolar" };

export default async function WarehousesPage() {
  const warehouses = await listWarehouses();
  return (
    <div>
      <PageHeader title="Depolar" description="Şirket depoları ve stok özeti." />
      {warehouses.length === 0 ? (
        <EmptyState title="Depo yok." />
      ) : (
        <Panel>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kod</TableHead>
                <TableHead>Ad</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead className="text-right">Kalem</TableHead>
                <TableHead className="text-right">Toplam elde</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {warehouses.map((wh) => {
                const onHand = wh.stocks.reduce((sum, s) => sum + s.onHand, 0);
                return (
                  <TableRow key={wh.id}>
                    <TableCell className="font-medium">{wh.code}</TableCell>
                    <TableCell>
                      {wh.name}
                      {wh.isDefault ? (
                        <span className="ml-2 text-xs text-muted-foreground">varsayılan</span>
                      ) : null}
                    </TableCell>
                    <TableCell>{wh.active ? "Aktif" : "Pasif"}</TableCell>
                    <TableCell className="text-right">{wh.stocks.length}</TableCell>
                    <TableCell className="text-right">
                      <Qty value={onHand} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Panel>
      )}
    </div>
  );
}
