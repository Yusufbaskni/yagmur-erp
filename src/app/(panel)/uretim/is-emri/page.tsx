import Link from "next/link";
import { EmptyState, LinkButton, PageHeader, Panel, Qty, StatusBadge } from "@/components/erp";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { workOrderStatusLabel } from "@/lib/labels";
import { listWorkOrders } from "@/server/queries";

export const metadata = { title: "İş emirleri" };

export default async function WorkOrdersPage() {
  const orders = await listWorkOrders();
  return (
    <div>
      <PageHeader
        title="İş emirleri"
        description="Üretim iş emirleri."
        actions={<LinkButton href="/uretim/is-emri/yeni">Yeni iş emri</LinkButton>}
      />
      {orders.length === 0 ? (
        <EmptyState
          title="İş emri yok."
          action={<LinkButton href="/uretim/is-emri/yeni">Yeni iş emri</LinkButton>}
        />
      ) : (
        <Panel>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No</TableHead>
                <TableHead>Tarih</TableHead>
                <TableHead>Mamul</TableHead>
                <TableHead>Depo</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead className="text-right">Miktar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((wo) => (
                <TableRow key={wo.id}>
                  <TableCell>
                    <Link href={`/uretim/is-emri/${wo.id}`} className="font-medium text-primary">
                      {wo.number}
                    </Link>
                  </TableCell>
                  <TableCell>{formatDate(wo.date)}</TableCell>
                  <TableCell>
                    {wo.product.sku} · {wo.product.name}
                  </TableCell>
                  <TableCell>{wo.warehouse.code}</TableCell>
                  <TableCell>
                    <StatusBadge code={wo.status} label={workOrderStatusLabel[wo.status]} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Qty value={wo.quantity} unit={wo.product.unit} />
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
