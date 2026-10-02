import Link from "next/link";
import { balanceLabel, EmptyState, LinkButton, PageHeader, Panel, StatusBadge } from "@/components/erp";
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
import { partyTypeLabel } from "@/lib/labels";
import { listParties } from "@/server/queries";

export const metadata = { title: "Cariler" };

export default async function PartiesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tur?: string }>;
}) {
  const { q = "", tur = "" } = await searchParams;
  const parties = await listParties({ q, type: tur });
  return (
    <div>
      <PageHeader
        title="Cariler"
        description="Müşteri alacakları ve tedarikçi borçları belgelerden hesaplanır."
        actions={<LinkButton href="/cariler/yeni">Yeni cari</LinkButton>}
      />
      <form className="mb-3 flex flex-wrap items-center gap-2" method="get">
        <Input name="q" defaultValue={q} placeholder="Ünvan, kod, şehir" className="w-56" />
        <select name="tur" defaultValue={tur} className="h-8 rounded-lg border border-input bg-card px-2 text-sm">
          <option value="">Tümü</option>
          <option value="CUSTOMER">Müşteri</option>
          <option value="SUPPLIER">Tedarikçi</option>
        </select>
        <Button type="submit" size="sm" variant="secondary">
          Süz
        </Button>
      </form>
      {parties.length === 0 ? (
        <EmptyState title="Bu süzgece uyan cari yok." action={<LinkButton href="/cariler/yeni">Yeni cari</LinkButton>} />
      ) : (
        <Panel>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kod</TableHead>
                <TableHead>Ünvan</TableHead>
                <TableHead>Tür</TableHead>
                <TableHead>Şehir</TableHead>
                <TableHead>Telefon</TableHead>
                <TableHead className="text-right">Bakiye</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {parties.map((party) => (
                <TableRow key={party.id}>
                  <TableCell>
                    <Link href={`/cariler/${party.id}`} className="font-medium text-primary">
                      {party.code}
                    </Link>
                  </TableCell>
                  <TableCell>{party.name}</TableCell>
                  <TableCell>
                    <StatusBadge code={party.type} label={partyTypeLabel[party.type]} />
                  </TableCell>
                  <TableCell>{party.city ?? "—"}</TableCell>
                  <TableCell>{party.phone ?? "—"}</TableCell>
                  <TableCell className="text-right">{balanceLabel(party.type, party.balance)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      )}
    </div>
  );
}
