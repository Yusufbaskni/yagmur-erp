import Link from "next/link";
import { EmptyState, LinkButton, PageHeader, Panel, Qty } from "@/components/erp";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listBoms } from "@/server/queries";

export const metadata = { title: "Ürün ağacı" };

export default async function BomsPage() {
  const boms = await listBoms();
  return (
    <div>
      <PageHeader
        title="Ürün ağacı (BOM)"
        description="Mamul ve bileşen tanımları."
        actions={<LinkButton href="/uretim/bom/yeni">Yeni BOM</LinkButton>}
      />
      {boms.length === 0 ? (
        <EmptyState title="BOM yok." action={<LinkButton href="/uretim/bom/yeni">Yeni BOM</LinkButton>} />
      ) : (
        <Panel>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kod</TableHead>
                <TableHead>Ad</TableHead>
                <TableHead>Mamul</TableHead>
                <TableHead className="text-right">Çıktı</TableHead>
                <TableHead className="text-right">Bileşen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {boms.map((bom) => (
                <TableRow key={bom.id}>
                  <TableCell>
                    <Link href={`/uretim/bom/${bom.id}`} className="font-medium text-primary">
                      {bom.code}
                    </Link>
                  </TableCell>
                  <TableCell>{bom.name}</TableCell>
                  <TableCell>
                    {bom.finishedProduct.sku} · {bom.finishedProduct.name}
                  </TableCell>
                  <TableCell className="text-right">
                    <Qty value={bom.outputQty} unit={bom.finishedProduct.unit} />
                  </TableCell>
                  <TableCell className="text-right">{bom.lines.length}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      )}
    </div>
  );
}
