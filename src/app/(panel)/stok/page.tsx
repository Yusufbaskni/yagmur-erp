import Link from "next/link";
import { EmptyState, LinkButton, PageHeader, Panel, Qty, StatusBadge } from "@/components/erp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { movementSourceLabel, movementTypeLabel } from "@/lib/labels";
import { listMovements } from "@/server/queries";

export const metadata = { title: "Stok hareketleri" };

export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const needle = q.trim().toLowerCase();
  const movements = (await listMovements()).filter((movement) => {
    if (!needle) return true;
    return (
      movement.product.sku.toLowerCase().includes(needle) ||
      movement.product.name.toLowerCase().includes(needle) ||
      (movement.sourceLabel ?? "").toLowerCase().includes(needle) ||
      (movement.note ?? "").toLowerCase().includes(needle)
    );
  });
  return (
    <div>
      <PageHeader
        title="Stok hareketleri"
        description="Giriş, çıkış ve sayım. Satış faturası stok düşer, mal kabul stok artırır."
        actions={<LinkButton href="/stok/yeni">Yeni hareket</LinkButton>}
      />
      <form className="mb-3 flex gap-2" method="get">
        <Input name="q" defaultValue={q} placeholder="Ürün, belge, açıklama" className="w-64" />
        <Button type="submit" size="sm" variant="secondary">
          Süz
        </Button>
      </form>
      {movements.length === 0 ? (
        <EmptyState title="Hareket yok." />
      ) : (
        <Panel>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tarih</TableHead>
                <TableHead>Ürün</TableHead>
                <TableHead>Tür</TableHead>
                <TableHead>Kaynak</TableHead>
                <TableHead className="text-right">Miktar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.map((movement) => {
                const href =
                  movement.source === "SALES_INVOICE" ||
                  movement.source === "INVOICE_CANCEL" ||
                  movement.source === "SALES_RETURN"
                    ? movement.sourceId
                      ? `/satis/faturalar/${movement.sourceId}`
                      : null
                    : movement.source === "GOODS_RECEIPT" ||
                        movement.source === "RECEIPT_CANCEL" ||
                        movement.source === "PURCHASE_RETURN"
                      ? movement.sourceId
                        ? `/satin-alma/mal-kabul/${movement.sourceId}`
                        : null
                      : null;
                return (
                  <TableRow key={movement.id}>
                    <TableCell>{formatDate(movement.date)}</TableCell>
                    <TableCell>
                      <Link href={`/urunler/${movement.productId}`} className="font-medium text-primary">
                        {movement.product.sku}
                      </Link>
                      <p className="text-xs text-muted-foreground">{movement.product.name}</p>
                    </TableCell>
                    <TableCell>
                      <StatusBadge code={movement.type} label={movementTypeLabel[movement.type]} />
                    </TableCell>
                    <TableCell>
                      {href ? (
                        <Link href={href} className="text-primary">
                          {movement.sourceLabel}
                        </Link>
                      ) : (
                        movement.sourceLabel || movementSourceLabel[movement.source]
                      )}
                      {movement.note ? (
                        <p className="text-xs text-muted-foreground">{movement.note}</p>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right">
                      <Qty value={movement.signedQty} unit={movement.product.unit} />
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
