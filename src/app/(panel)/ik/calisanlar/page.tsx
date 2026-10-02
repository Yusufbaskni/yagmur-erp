import Link from "next/link";
import { EmptyState, LinkButton, PageHeader, Panel } from "@/components/erp";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listEmployees } from "@/server/queries";

export const metadata = { title: "Çalışanlar" };

export default async function EmployeesPage() {
  const employees = await listEmployees();
  return (
    <div>
      <PageHeader
        title="Çalışanlar"
        description="Personel kartları."
        actions={<LinkButton href="/ik/calisanlar/yeni">Yeni çalışan</LinkButton>}
      />
      {employees.length === 0 ? (
        <EmptyState
          title="Çalışan yok."
          action={<LinkButton href="/ik/calisanlar/yeni">Yeni çalışan</LinkButton>}
        />
      ) : (
        <Panel>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kod</TableHead>
                <TableHead>Ad</TableHead>
                <TableHead>Ünvan</TableHead>
                <TableHead>Departman</TableHead>
                <TableHead>Durum</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((emp) => (
                <TableRow key={emp.id}>
                  <TableCell>
                    <Link href={`/ik/calisanlar/${emp.id}`} className="font-medium text-primary">
                      {emp.code}
                    </Link>
                  </TableCell>
                  <TableCell>{emp.name}</TableCell>
                  <TableCell>{emp.title || "—"}</TableCell>
                  <TableCell>{emp.department?.name ?? "—"}</TableCell>
                  <TableCell>{emp.active ? "Aktif" : "Pasif"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      )}
    </div>
  );
}
