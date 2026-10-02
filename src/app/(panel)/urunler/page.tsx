import Link from "next/link";
import { EmptyState, LinkButton, Money, PageHeader, Panel, Qty, StatusBadge } from "@/components/erp";
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
import { listProducts } from "@/server/queries";

export const metadata = { title: "Ürünler" };

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const products = await listProducts({ q });
  return (
    <div>
      <PageHeader
        title="Ürünler"
        description="Satış ve alış fiyatı ile eldeki stok."
        actions={<LinkButton href="/urunler/yeni">Yeni ürün</LinkButton>}
      />
      <form className="mb-3 flex gap-2" method="get">
        <Input name="q" defaultValue={q} placeholder="SKU, barkod veya ad" className="w-56" />
        <Button type="submit" size="sm" variant="secondary">
          Süz
        </Button>
      </form>
      {products.length === 0 ? (
        <EmptyState title="Ürün yok." action={<LinkButton href="/urunler/yeni">Yeni ürün</LinkButton>} />
      ) : (
        <Panel>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Ad</TableHead>
                <TableHead>Birim</TableHead>
                <TableHead className="text-right">Satış</TableHead>
                <TableHead className="text-right">Alış</TableHead>
                <TableHead className="text-right">Stok</TableHead>
                <TableHead>Durum</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => {
                const low = product.stockOnHand <= product.minStock;
                return (
                  <TableRow key={product.id}>
                    <TableCell>
                      <Link href={`/urunler/${product.id}`} className="font-medium text-primary">
                        {product.sku}
                      </Link>
                      {product.barcode ? (
                        <p className="text-xs text-muted-foreground">{product.barcode}</p>
                      ) : null}
                    </TableCell>
                    <TableCell>{product.name}</TableCell>
                    <TableCell>{product.unit}</TableCell>
                    <TableCell className="text-right">
                      <Money value={product.salePrice} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Money value={product.purchasePrice} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Qty value={product.stockOnHand} />
                    </TableCell>
                    <TableCell>
                      {low ? <StatusBadge code="LOW" label="Düşük" /> : product.active ? "Normal" : "Pasif"}
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
