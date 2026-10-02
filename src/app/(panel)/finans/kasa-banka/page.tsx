import { EmptyState, Money, PageHeader, Panel } from "@/components/erp";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { listMoneyAccounts } from "@/server/queries";

export const metadata = { title: "Kasa / banka" };

export default async function MoneyAccountsPage() {
  const accounts = await listMoneyAccounts();
  return (
    <div>
      <PageHeader title="Kasa / banka" description="Nakit ve banka hesap bakiyeleri." />
      {accounts.length === 0 ? (
        <EmptyState title="Hesap yok." />
      ) : (
        <div className="grid gap-4">
          {accounts.map((account) => (
            <Panel key={account.id}>
              <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-3">
                <div>
                  <p className="text-sm font-semibold">
                    {account.code} · {account.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {account.type === "CASH" ? "Kasa" : "Banka"} · {account.currencyCode}
                    {!account.active ? " · pasif" : ""}
                  </p>
                </div>
                <Money value={account.balance} className="text-lg font-semibold" />
              </div>
              {account.movements.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tarih</TableHead>
                      <TableHead>Tür</TableHead>
                      <TableHead className="text-right">Tutar</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {account.movements.map((mv) => (
                      <TableRow key={mv.id}>
                        <TableCell>{formatDate(mv.date)}</TableCell>
                        <TableCell>{mv.type}</TableCell>
                        <TableCell className="text-right">
                          <Money value={mv.signedAmount} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="px-3 pb-3 text-sm text-muted-foreground">Hareket yok.</p>
              )}
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
