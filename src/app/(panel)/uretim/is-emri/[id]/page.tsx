import { notFound } from "next/navigation";
import { ErrorNote, PageHeader, Panel, Qty, StatusBadge } from "@/components/erp";
import { PostButton } from "@/components/forms";
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
import { completeWorkOrderAction } from "@/server/actions";
import { getWorkOrder } from "@/server/queries";

export const metadata = { title: "İş emri" };

export default async function WorkOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ hata?: string }>;
}) {
  const { id } = await params;
  const { hata } = await searchParams;
  const wo = await getWorkOrder(id);
  if (!wo) notFound();
  return (
    <div>
      <PageHeader
        eyebrow="İş emri"
        title={wo.number}
        description={`${formatDate(wo.date)} · ${wo.product.name}`}
        actions={
          <>
            <StatusBadge code={wo.status} label={workOrderStatusLabel[wo.status]} />
            {wo.status === "DRAFT" || wo.status === "RELEASED" ? (
              <PostButton action={completeWorkOrderAction} id={wo.id} label="Tamamla" />
            ) : null}
          </>
        }
      />
      <ErrorNote message={hata} />
      <div className="mb-4 grid gap-3 text-sm sm:grid-cols-3">
        <Info label="Mamul" value={`${wo.product.sku} · ${wo.product.name}`} />
        <Info label="Depo" value={`${wo.warehouse.code} · ${wo.warehouse.name}`} />
        <Info label="Miktar" value={<Qty value={wo.quantity} unit={wo.product.unit} />} />
      </div>
      {wo.bom ? (
        <Panel>
          <h2 className="px-3 py-2 text-sm font-semibold">
            BOM: {wo.bom.code} · {wo.bom.name}
          </h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bileşen</TableHead>
                <TableHead className="text-right">Birim miktar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {wo.bom.lines.map((line) => (
                <TableRow key={line.id}>
                  <TableCell>
                    {line.product.sku} · {line.product.name}
                  </TableCell>
                  <TableCell className="text-right">
                    <Qty value={line.quantity} unit={line.product.unit} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      ) : null}
      {wo.notes ? <p className="mt-3 text-sm text-muted-foreground">{wo.notes}</p> : null}
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-card px-3 py-2 ring-1 ring-foreground/10">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
