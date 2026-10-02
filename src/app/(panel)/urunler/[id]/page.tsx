import Link from "next/link";
import { notFound } from "next/navigation";
import { ErrorNote, LinkButton, Money, PageHeader, Panel, Qty, StatusBadge } from "@/components/erp";
import { PostButton } from "@/components/forms";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatQty } from "@/lib/format";
import { movementSourceLabel, movementTypeLabel } from "@/lib/labels";
import { deleteProductAction } from "@/server/actions";
import { getProduct } from "@/server/queries";

export const metadata = { title: "Ürün" };

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ hata?: string }>;
}) {
  const { id } = await params;
  const { hata } = await searchParams;
  const product = await getProduct(id);
  if (!product) notFound();
  const low = product.stockOnHand <= product.minStock;
  return (
    <div>
      <PageHeader
        eyebrow={product.sku}
        title={product.name}
        description={`${product.unit} · elde ${formatQty(product.stockOnHand)} ${product.unit}${product.barcode ? ` · ${product.barcode}` : ""}`}
        actions={
          <>
            {low ? <StatusBadge code="LOW" label="Düşük stok" /> : null}
            <LinkButton href={`/urunler/${product.id}/duzenle`} variant="outline">
              Düzenle
            </LinkButton>
            <LinkButton href="/stok/yeni" variant="secondary">
              Stok hareketi
            </LinkButton>
            <PostButton action={deleteProductAction} id={product.id} label="Sil" variant="destructive" />
          </>
        }
      />
      <ErrorNote message={hata} />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Satış fiyatı" value={<Money value={product.salePrice} />} />
        <Stat label="Alış fiyatı" value={<Money value={product.purchasePrice} />} />
        <Stat label="KDV" value={`%${product.vatRate}`} />
        <Stat label="Asgari stok" value={<Qty value={product.minStock} unit={product.unit} />} />
      </div>
      {product.warehouseStocks.length > 0 ? (
        <Panel className="mb-4">
          <h2 className="px-3 py-2 text-sm font-semibold">Depo stokları</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Depo</TableHead>
                <TableHead className="text-right">Elde</TableHead>
                <TableHead className="text-right">Rezerv</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {product.warehouseStocks.map((stock) => (
                <TableRow key={stock.id}>
                  <TableCell>
                    {stock.warehouse.code} · {stock.warehouse.name}
                  </TableCell>
                  <TableCell className="text-right">
                    <Qty value={stock.onHand} unit={product.unit} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Qty value={stock.reserved} unit={product.unit} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      ) : null}
      <Panel>
        <h2 className="px-3 py-2 text-sm font-semibold">Son hareketler</h2>
        {product.movements.length === 0 ? (
          <p className="px-3 pb-3 text-sm text-muted-foreground">Hareket yok.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tarih</TableHead>
                <TableHead>Tür</TableHead>
                <TableHead>Kaynak</TableHead>
                <TableHead className="text-right">Miktar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {product.movements.map((movement) => (
                <TableRow key={movement.id}>
                  <TableCell>{formatDate(movement.date)}</TableCell>
                  <TableCell>
                    <StatusBadge code={movement.type} label={movementTypeLabel[movement.type]} />
                  </TableCell>
                  <TableCell>
                    {movement.sourceLabel || movementSourceLabel[movement.source]}
                    {movement.note ? (
                      <p className="text-xs text-muted-foreground">{movement.note}</p>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right">
                    <Qty value={movement.signedQty} unit={product.unit} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-card px-3 py-3 ring-1 ring-foreground/10">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}
