import Link from "next/link";
import { EmptyState, PageHeader, Panel, StatusBadge } from "@/components/erp";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { eInvoiceStatusLabel } from "@/lib/labels";
import { listEInvoices } from "@/server/queries";

export const metadata = { title: "e-Fatura" };

export default async function EInvoicesPage() {
  const docs = await listEInvoices();
  return (
    <div>
      <PageHeader
        title="e-Fatura"
        description="Sandbox e-Fatura belgeleri. Canlı GİB bağlantısı yoktur."
      />
      {docs.length === 0 ? (
        <EmptyState title="e-Fatura yok. Satış faturasından oluşturun." />
      ) : (
        <Panel>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No</TableHead>
                <TableHead>Yön</TableHead>
                <TableHead>Satış faturası</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Oluşturma</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {docs.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell>
                    <Link href={`/e-fatura/${doc.id}`} className="font-medium text-primary">
                      {doc.number}
                    </Link>
                  </TableCell>
                  <TableCell>{doc.direction === "OUTGOING" ? "Giden" : "Gelen"}</TableCell>
                  <TableCell>
                    {doc.salesInvoice ? (
                      <Link href={`/satis/faturalar/${doc.salesInvoiceId}`} className="text-primary">
                        {doc.salesInvoice.number}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge code={doc.status} label={eInvoiceStatusLabel[doc.status]} />
                  </TableCell>
                  <TableCell>{formatDate(doc.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      )}
    </div>
  );
}
