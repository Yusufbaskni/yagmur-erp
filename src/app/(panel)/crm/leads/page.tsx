import { EmptyState, ErrorNote, PageHeader, Panel, StatusBadge, fieldClass } from "@/components/erp";
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
import { formatDate } from "@/lib/format";
import { leadStatusLabel } from "@/lib/labels";
import { createLeadAction } from "@/server/actions";
import { formOptions, listLeads } from "@/server/queries";

export const metadata = { title: "Leadler" };

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ hata?: string }>;
}) {
  const { hata } = await searchParams;
  const [leads, opts] = await Promise.all([listLeads(), formOptions()]);
  return (
    <div>
      <PageHeader title="Leadler" description="Potansiyel müşteri adayları." />
      <ErrorNote message={hata} />
      <Panel className="mb-4 p-3">
        <h2 className="mb-3 text-sm font-semibold">Yeni lead</h2>
        <form action={createLeadAction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="grid gap-1 text-xs">
            <span>Ad</span>
            <Input name="name" required />
          </label>
          <label className="grid gap-1 text-xs">
            <span>Firma</span>
            <Input name="companyName" />
          </label>
          <label className="grid gap-1 text-xs">
            <span>Telefon</span>
            <Input name="phone" />
          </label>
          <label className="grid gap-1 text-xs">
            <span>E-posta</span>
            <Input name="email" type="email" />
          </label>
          <label className="grid gap-1 text-xs">
            <span>Kaynak</span>
            <Input name="source" />
          </label>
          <label className="grid gap-1 text-xs">
            <span>Cari (opsiyonel)</span>
            <select name="partyId" className={fieldClass} defaultValue="">
              <option value="">—</option>
              {opts.customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} · {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs sm:col-span-2 lg:col-span-3">
            <span>Not</span>
            <Input name="notes" />
          </label>
          <div>
            <Button type="submit" size="sm">
              Kaydet
            </Button>
          </div>
        </form>
      </Panel>
      {leads.length === 0 ? (
        <EmptyState title="Lead yok." />
      ) : (
        <Panel>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ad</TableHead>
                <TableHead>Firma</TableHead>
                <TableHead>İletişim</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Tarih</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell className="font-medium">{lead.name}</TableCell>
                  <TableCell>{lead.companyName || "—"}</TableCell>
                  <TableCell>
                    {[lead.phone, lead.email].filter(Boolean).join(" · ") || "—"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge code={lead.status} label={leadStatusLabel[lead.status]} />
                  </TableCell>
                  <TableCell>{formatDate(lead.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      )}
    </div>
  );
}
