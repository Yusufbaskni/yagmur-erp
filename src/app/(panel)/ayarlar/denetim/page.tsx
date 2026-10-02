import { EmptyState, PageHeader, Panel } from "@/components/erp";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { listAuditLogs } from "@/server/queries";

export const metadata = { title: "Denetim kaydı" };

export default async function AuditPage() {
  const logs = await listAuditLogs();
  return (
    <div>
      <PageHeader
        title="Denetim kaydı"
        description="Şirket içi işlem izleri (son 100)."
      />
      {logs.length === 0 ? (
        <EmptyState title="Kayıt yok." />
      ) : (
        <Panel>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tarih</TableHead>
                <TableHead>Kullanıcı</TableHead>
                <TableHead>İşlem</TableHead>
                <TableHead>Özet</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>{formatDate(log.createdAt)}</TableCell>
                  <TableCell>{log.user?.name ?? "—"}</TableCell>
                  <TableCell>
                    <span className="font-medium">{log.action}</span>
                    <p className="text-xs text-muted-foreground">
                      {log.entityType}
                      {log.entityId ? ` · ${log.entityId.slice(0, 8)}` : ""}
                    </p>
                  </TableCell>
                  <TableCell>
                    {log.summary}
                    {log.detail ? (
                      <p className="text-xs text-muted-foreground">{log.detail}</p>
                    ) : null}
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
