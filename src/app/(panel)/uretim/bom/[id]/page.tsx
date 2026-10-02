import { notFound } from "next/navigation";
import { PageHeader, Panel, Qty } from "@/components/erp";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getBom } from "@/server/queries";

export const metadata = { title: "BOM" };

export default async function BomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bom = await getBom(id);
  if (!bom) notFound();
  return (
    <div>
      <PageHeader
        eyebrow={bom.code}
        title={bom.name}
        description={`Mamul: ${bom.finishedProduct.sku} · ${bom.finishedProduct.name}`}
      />
      <p className="mb-4 text-sm text-muted-foreground">
        Çıktı miktarı: <Qty value={bom.outputQty} unit={bom.finishedProduct.unit} />
      </p>
      <Panel>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Bileşen</TableHead>
              <TableHead className="text-right">Miktar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bom.lines.map((line) => (
              <TableRow key={line.id}>
                <TableCell className="font-medium">{line.product.sku}</TableCell>
                <TableCell>{line.product.name}</TableCell>
                <TableCell className="text-right">
                  <Qty value={line.quantity} unit={line.product.unit} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
    </div>
  );
}
