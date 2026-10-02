import { EmptyState, PageHeader, Panel, StatusBadge, fieldClass } from "@/components/erp";
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
import { todayInput, addDaysInput } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import { leaveStatusLabel } from "@/lib/labels";
import { createLeaveAction, setLeaveStatusAction } from "@/server/actions";
import { listEmployees, listLeaveRequests } from "@/server/queries";

export const metadata = { title: "İzinler" };

export default async function LeavesPage() {
  const [leaves, employees] = await Promise.all([listLeaveRequests(), listEmployees()]);
  return (
    <div>
      <PageHeader title="İzinler" description="İzin talepleri ve onay." />
      <Panel className="mb-4 p-3">
        <h2 className="mb-3 text-sm font-semibold">Yeni izin talebi</h2>
        <form action={createLeaveAction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="grid gap-1 text-xs">
            <span>Çalışan</span>
            <select name="employeeId" className={fieldClass} defaultValue={employees[0]?.id} required>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.code} · {emp.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs">
            <span>Başlangıç</span>
            <Input type="date" name="startDate" defaultValue={todayInput()} required />
          </label>
          <label className="grid gap-1 text-xs">
            <span>Bitiş</span>
            <Input type="date" name="endDate" defaultValue={addDaysInput(1)} required />
          </label>
          <label className="grid gap-1 text-xs">
            <span>Gün</span>
            <Input name="days" defaultValue="1" inputMode="numeric" required />
          </label>
          <label className="grid gap-1 text-xs">
            <span>Sebep</span>
            <Input name="reason" />
          </label>
          <div className="sm:col-span-2 lg:col-span-5">
            <Button type="submit" size="sm" disabled={employees.length === 0}>
              Talep oluştur
            </Button>
          </div>
        </form>
      </Panel>
      {leaves.length === 0 ? (
        <EmptyState title="İzin talebi yok." />
      ) : (
        <Panel>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Çalışan</TableHead>
                <TableHead>Tarih</TableHead>
                <TableHead>Gün</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>İşlem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leaves.map((leave) => (
                <TableRow key={leave.id}>
                  <TableCell>
                    {leave.employee.code} · {leave.employee.name}
                    {leave.reason ? (
                      <p className="text-xs text-muted-foreground">{leave.reason}</p>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {formatDate(leave.startDate)} – {formatDate(leave.endDate)}
                  </TableCell>
                  <TableCell>{leave.days}</TableCell>
                  <TableCell>
                    <StatusBadge code={leave.status} label={leaveStatusLabel[leave.status]} />
                  </TableCell>
                  <TableCell>
                    {leave.status === "PENDING" ? (
                      <div className="flex flex-wrap gap-1">
                        <form action={setLeaveStatusAction}>
                          <input type="hidden" name="id" value={leave.id} />
                          <input type="hidden" name="status" value="APPROVED" />
                          <Button type="submit" size="sm">
                            Onayla
                          </Button>
                        </form>
                        <form action={setLeaveStatusAction}>
                          <input type="hidden" name="id" value={leave.id} />
                          <input type="hidden" name="status" value="REJECTED" />
                          <Button type="submit" size="sm" variant="outline">
                            Red
                          </Button>
                        </form>
                      </div>
                    ) : (
                      "—"
                    )}
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
