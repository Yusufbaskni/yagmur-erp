import Link from "next/link";
import { EmptyState, LinkButton, Money, PageHeader, Panel, StatusBadge } from "@/components/erp";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { purchaseOrderStatusLabel } from "@/lib/labels";
import { listPurchaseOrders } from "@/server/queries";

export const metadata = { title: "Satın alma" };

export default async function PurchasesPage({
  searchParams,
}: {
  searchParams: Promise<{ durum?: string }>;
}) {
  const { durum = "" } = await searchParams;
  const orders = await listPurchaseOrders({ durum });
  return (
    <div>
      <PageHeader
        title="Satın alma"
        description="Onaylı sipariş mal kabul edilince stok artar; borç alış faturası ile açılır."
        actions={<LinkButton href="/satin-alma/yeni">Yeni sipariş</LinkButton>}
      />
      <form className="mb-3 flex flex-wrap gap-2" method="get">
        <select name="durum" defaultValue={durum} className="h-8 rounded-lg border border-input bg-card px-2 text-sm">
          <option value="">Tüm durumlar</option>
          <option value="TASLAK">Taslak</option>
          <option value="ONAYLI">Onaylı</option>
          <option value="TESLIM">Teslim alındı</option>
        </select>
        <Button type="submit" size="sm" variant="secondary">
          Süz
        </Button>
      </form>
      {orders.length === 0 ? (
        <EmptyState title="Satın alma yok." action={<LinkButton href="/satin-alma/yeni">Yeni sipariş</LinkButton>} />
      ) : (
        <Panel>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No</TableHead>
                <TableHead>Tarih</TableHead>
                <TableHead>Tedarikçi</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead className="text-right">Tutar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => {
                const total = order.lines.reduce((sum, line) => sum + line.lineTotal, 0);
                return (
                  <TableRow key={order.id}>
                    <TableCell>
                      <Link href={`/satin-alma/${order.id}`} className="font-medium text-primary">
                        {order.number}
                      </Link>
                    </TableCell>
                    <TableCell>{formatDate(order.date)}</TableCell>
                    <TableCell>{order.party.name}</TableCell>
                    <TableCell>
                      <StatusBadge code={order.status} label={purchaseOrderStatusLabel[order.status]} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Money value={total} />
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
