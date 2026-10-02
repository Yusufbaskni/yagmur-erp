import Link from "next/link";
import { notFound } from "next/navigation";
import {
  balanceLabel,
  ErrorNote,
  LinkButton,
  Money,
  PageHeader,
  Panel,
  StatusBadge,
} from "@/components/erp";
import { PostButton } from "@/components/forms";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import {
  invoiceStatusLabel,
  partyTypeLabel,
  paymentMethodLabel,
  purchaseOrderStatusLabel,
  salesOrderStatusLabel,
} from "@/lib/labels";
import { deletePartyAction } from "@/server/actions";
import { getParty } from "@/server/queries";

export const metadata = { title: "Cari" };

export default async function PartyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ hata?: string }>;
}) {
  const { id } = await params;
  const { hata } = await searchParams;
  const data = await getParty(id);
  if (!data) notFound();
  const { party } = data;
  return (
    <div>
      <PageHeader
        eyebrow={party.code}
        title={party.name}
        description={`${partyTypeLabel[party.type]} · ${balanceLabel(party.type, data.balance)}`}
        actions={
          <>
            <StatusBadge code={party.type} label={partyTypeLabel[party.type]} />
            {!party.active ? <StatusBadge code="CANCELLED" label="Pasif" /> : null}
            <LinkButton href={`/cariler/${party.id}/duzenle`} variant="outline">
              Düzenle
            </LinkButton>
            <PostButton action={deletePartyAction} id={party.id} label="Sil" variant="destructive" />
          </>
        }
      />
      <ErrorNote message={hata} />
      <div className="mb-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <Info label="Vergi" value={[party.taxNumber, party.taxOffice].filter(Boolean).join(" · ") || "—"} />
        <Info label="Telefon" value={party.phone || "—"} />
        <Info label="E-posta" value={party.email || "—"} />
        <Info label="Adres" value={[party.address, party.city].filter(Boolean).join(", ") || "—"} />
      </div>
      {party.notes ? <p className="mb-4 text-sm text-muted-foreground">{party.notes}</p> : null}
      <div className="grid gap-4 xl:grid-cols-2">
        {party.type === "CUSTOMER" ? (
          <Mini title="Satış faturaları" empty="Fatura yok.">
            {data.invoices.map((invoice) => (
              <Row
                key={invoice.id}
                href={`/satis/faturalar/${invoice.id}`}
                title={invoice.number}
                meta={formatDate(invoice.date)}
                status={invoice.status}
                label={invoiceStatusLabel[invoice.status]}
                amount={invoice.total - invoice.paidAmount}
              />
            ))}
          </Mini>
        ) : (
          <Mini title="Alış faturaları" empty="Alış faturası yok.">
            {data.receipts.map((invoice) => (
              <Row
                key={invoice.id}
                href={`/satin-alma/faturalar/${invoice.id}`}
                title={invoice.number}
                meta={formatDate(invoice.date)}
                status={invoice.status}
                label={invoiceStatusLabel[invoice.status]}
                amount={invoice.total - invoice.paidAmount}
              />
            ))}
          </Mini>
        )}
        <Mini title="Tahsilat ve ödemeler" empty="Hareket yok.">
          {data.payments.map((payment) => (
            <Row
              key={payment.id}
              href={payment.type === "COLLECTION" ? `/tahsilat/${payment.id}` : `/odeme/${payment.id}`}
              title={payment.number}
              meta={`${formatDate(payment.date)} · ${paymentMethodLabel[payment.method]}`}
              amount={payment.amount}
            />
          ))}
        </Mini>
        <Mini title="Satış siparişleri" empty="Sipariş yok.">
          {data.salesOrders.map((order) => (
            <Row
              key={order.id}
              href={`/satis/${order.id}`}
              title={order.number}
              meta={formatDate(order.date)}
              status={order.status}
              label={salesOrderStatusLabel[order.status]}
            />
          ))}
        </Mini>
        <Mini title="Satın alma siparişleri" empty="Sipariş yok.">
          {data.purchaseOrders.map((order) => (
            <Row
              key={order.id}
              href={`/satin-alma/${order.id}`}
              title={order.number}
              meta={formatDate(order.date)}
              status={order.status}
              label={purchaseOrderStatusLabel[order.status]}
            />
          ))}
        </Mini>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-card px-3 py-2 ring-1 ring-foreground/10">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p>{value}</p>
    </div>
  );
}

function Mini({ title, empty, children }: { title: string; empty: string; children: React.ReactNode[] }) {
  return (
    <Panel>
      <h2 className="px-3 py-2 text-sm font-semibold">{title}</h2>
      {children.length === 0 ? (
        <p className="px-3 pb-3 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Belge</TableHead>
              <TableHead>Durum</TableHead>
              <TableHead className="text-right">Tutar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>{children}</TableBody>
        </Table>
      )}
    </Panel>
  );
}

function Row({
  href,
  title,
  meta,
  status,
  label,
  amount,
}: {
  href: string;
  title: string;
  meta: string;
  status?: string;
  label?: string;
  amount?: number;
}) {
  return (
    <TableRow>
      <TableCell>
        <Link href={href} className="font-medium text-primary">
          {title}
        </Link>
        <p className="text-xs text-muted-foreground">{meta}</p>
      </TableCell>
      <TableCell>{status && label ? <StatusBadge code={status} label={label} /> : "—"}</TableCell>
      <TableCell className="text-right">{amount !== undefined ? <Money value={amount} /> : "—"}</TableCell>
    </TableRow>
  );
}
