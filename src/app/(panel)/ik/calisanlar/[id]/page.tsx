import { notFound } from "next/navigation";
import { PageHeader, Panel, StatusBadge } from "@/components/erp";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { leaveStatusLabel } from "@/lib/labels";
import { getEmployee } from "@/server/queries";

export const metadata = { title: "Çalışan" };

export default async function EmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const emp = await getEmployee(id);
  if (!emp) notFound();
  return (
    <div>
      <PageHeader
        eyebrow={emp.code}
        title={emp.name}
        description={[emp.title, emp.department?.name].filter(Boolean).join(" · ") || "Personel"}
      />
      <div className="mb-4 grid gap-3 text-sm sm:grid-cols-3">
        <Info label="E-posta" value={emp.email || "—"} />
        <Info label="Telefon" value={emp.phone || "—"} />
        <Info label="İşe giriş" value={emp.hireDate ? formatDate(emp.hireDate) : "—"} />
      </div>
      <Panel>
        <h2 className="px-3 py-2 text-sm font-semibold">İzinler</h2>
        {emp.leaveRequests.length === 0 ? (
          <p className="px-3 pb-3 text-sm text-muted-foreground">İzin kaydı yok.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Başlangıç</TableHead>
                <TableHead>Bitiş</TableHead>
                <TableHead>Gün</TableHead>
                <TableHead>Durum</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {emp.leaveRequests.map((leave) => (
                <TableRow key={leave.id}>
                  <TableCell>{formatDate(leave.startDate)}</TableCell>
                  <TableCell>{formatDate(leave.endDate)}</TableCell>
                  <TableCell>{leave.days}</TableCell>
                  <TableCell>
                    <StatusBadge code={leave.status} label={leaveStatusLabel[leave.status]} />
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

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-card px-3 py-2 ring-1 ring-foreground/10">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
