import { EmptyState, ErrorNote, Money, PageHeader, Panel, StatusBadge, fieldClass } from "@/components/erp";
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
import { opportunityStageLabel } from "@/lib/labels";
import { createOpportunityAction } from "@/server/actions";
import { formOptions, listLeads, listOpportunities } from "@/server/queries";

export const metadata = { title: "Fırsatlar" };

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ hata?: string }>;
}) {
  const { hata } = await searchParams;
  const [opps, leads, opts] = await Promise.all([
    listOpportunities(),
    listLeads(),
    formOptions(),
  ]);
  return (
    <div>
      <PageHeader title="Fırsatlar" description="Satış fırsatları ve aşamalar." />
      <ErrorNote message={hata} />
      <Panel className="mb-4 p-3">
        <h2 className="mb-3 text-sm font-semibold">Yeni fırsat</h2>
        <form action={createOpportunityAction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="grid gap-1 text-xs">
            <span>Başlık</span>
            <Input name="title" required />
          </label>
          <label className="grid gap-1 text-xs">
            <span>Tutar (TL)</span>
            <Input name="amount" defaultValue="0" inputMode="decimal" />
          </label>
          <label className="grid gap-1 text-xs">
            <span>Aşama</span>
            <select name="stage" defaultValue="QUALIFICATION" className={fieldClass}>
              {Object.entries(opportunityStageLabel).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs">
            <span>Lead</span>
            <select name="leadId" className={fieldClass} defaultValue="">
              <option value="">—</option>
              {leads.map((lead) => (
                <option key={lead.id} value={lead.id}>
                  {lead.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs">
            <span>Cari</span>
            <select name="partyId" className={fieldClass} defaultValue="">
              <option value="">—</option>
              {opts.customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} · {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs">
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
      {opps.length === 0 ? (
        <EmptyState title="Fırsat yok." />
      ) : (
        <Panel>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Başlık</TableHead>
                <TableHead>Cari / Lead</TableHead>
                <TableHead>Aşama</TableHead>
                <TableHead className="text-right">Tutar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {opps.map((opp) => (
                <TableRow key={opp.id}>
                  <TableCell className="font-medium">{opp.title}</TableCell>
                  <TableCell>{opp.party?.name || opp.lead?.name || "—"}</TableCell>
                  <TableCell>
                    <StatusBadge code={opp.stage} label={opportunityStageLabel[opp.stage]} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Money value={opp.amount} />
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
