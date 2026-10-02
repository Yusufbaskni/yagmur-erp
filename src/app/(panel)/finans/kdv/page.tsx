import { Money, PageHeader, Panel } from "@/components/erp";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getVatReport } from "@/server/queries";

export const metadata = { title: "KDV raporu" };

export default async function VatReportPage() {
  const report = await getVatReport();
  const net = report.salesVat - report.purchaseVat;
  return (
    <div>
      <PageHeader
        title="KDV raporu"
        description="Bu ayın satılan ve alınan KDV özeti (iptal hariç)."
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Kpi label="Satış KDV" value={report.salesVat} />
        <Kpi label="Alış KDV" value={report.purchaseVat} />
        <Kpi label="Net KDV" value={net} />
      </div>
      <Panel>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kalem</TableHead>
              <TableHead className="text-right">Net (KDV hariç)</TableHead>
              <TableHead className="text-right">KDV</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>Satış faturaları</TableCell>
              <TableCell className="text-right">
                <Money value={report.salesNet} />
              </TableCell>
              <TableCell className="text-right">
                <Money value={report.salesVat} />
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Alış faturaları</TableCell>
              <TableCell className="text-right">
                <Money value={report.purchaseNet} />
              </TableCell>
              <TableCell className="text-right">
                <Money value={report.purchaseVat} />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Panel>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-2 text-2xl font-semibold">
        <Money value={value} />
      </p>
    </div>
  );
}
