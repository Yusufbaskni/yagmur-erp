import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "cn";
import { formatMoney, formatQty } from "@/lib/format";

const tones: Record<string, string> = {
  DRAFT: "border-transparent bg-stone-200 text-stone-700",
  CONFIRMED: "border-transparent bg-sky-100 text-sky-950",
  INVOICED: "border-transparent bg-emerald-100 text-emerald-950",
  RECEIVED: "border-transparent bg-emerald-100 text-emerald-950",
  CANCELLED: "border-transparent bg-stone-200/80 text-stone-500",
  OPEN: "border-transparent bg-amber-100 text-amber-950",
  PARTIAL: "border-transparent bg-sky-100 text-sky-950",
  PAID: "border-transparent bg-emerald-100 text-emerald-950",
  IN: "border-transparent bg-emerald-100 text-emerald-950",
  OUT: "border-transparent bg-rose-100 text-rose-950",
  ADJUSTMENT: "border-transparent bg-violet-100 text-violet-950",
  CUSTOMER: "border-transparent bg-teal-100 text-teal-950",
  SUPPLIER: "border-transparent bg-orange-100 text-orange-950",
  POSTED: "border-transparent bg-emerald-100 text-emerald-950",
  SHIPPED: "border-transparent bg-sky-100 text-sky-950",
  PORTFOLIO: "border-transparent bg-amber-100 text-amber-950",
  COLLECTED: "border-transparent bg-emerald-100 text-emerald-950",
  ENDORSED: "border-transparent bg-sky-100 text-sky-950",
  BOUNCED: "border-transparent bg-rose-100 text-rose-950",
  SENT: "border-transparent bg-sky-100 text-sky-950",
  ACCEPTED: "border-transparent bg-emerald-100 text-emerald-950",
  REJECTED: "border-transparent bg-rose-100 text-rose-950",
  PENDING: "border-transparent bg-amber-100 text-amber-950",
  APPROVED: "border-transparent bg-emerald-100 text-emerald-950",
  COMPLETED: "border-transparent bg-emerald-100 text-emerald-950",
  RELEASED: "border-transparent bg-sky-100 text-sky-950",
  NEW: "border-transparent bg-sky-100 text-sky-950",
  QUALIFICATION: "border-transparent bg-stone-200 text-stone-700",
  PROPOSAL: "border-transparent bg-sky-100 text-sky-950",
  NEGOTIATION: "border-transparent bg-amber-100 text-amber-950",
  WON: "border-transparent bg-emerald-100 text-emerald-950",
  LOST: "border-transparent bg-rose-100 text-rose-950",
  LOW: "border-transparent bg-rose-100 text-rose-950",
};

export function StatusBadge({ code, label }: { code: string; label: string }) {
  return (
    <Badge variant="outline" className={tones[code] ?? ""}>
      {label}
    </Badge>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow ? (
          <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function LinkButton({
  href,
  children,
  variant = "default",
}: {
  href: string;
  children: ReactNode;
  variant?: "default" | "outline" | "secondary" | "ghost";
}) {
  return (
    <Link href={href} className={cn(buttonVariants({ variant, size: "sm" }))}>
      {children}
    </Link>
  );
}

export function ErrorNote({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      {message}
    </div>
  );
}

export function EmptyState({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed bg-card px-4 py-10 text-center">
      <p className="text-sm text-muted-foreground">{title}</p>
      {action ? <div className="mt-3 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10", className)}>
      {children}
    </div>
  );
}

export function Money({ value, className }: { value: number; className?: string }) {
  return <span className={cn("tabular-nums", className)}>{formatMoney(value)}</span>;
}

export function Qty({ value, unit }: { value: number; unit?: string }) {
  return (
    <span className="tabular-nums">
      {formatQty(value)}
      {unit ? ` ${unit}` : ""}
    </span>
  );
}

export function balanceLabel(type: "CUSTOMER" | "SUPPLIER", balance: number) {
  if (balance === 0) return "Bakiye yok";
  return type === "CUSTOMER"
    ? `${formatMoney(balance)} alacak`
    : `${formatMoney(balance)} borç`;
}

export type DocLine = {
  id: string;
  sku: string;
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  vatRate?: number;
  vatAmount?: number;
  lineNet?: number;
  lineTotal: number;
};

export function LinesTable({ lines, showVat = false }: { lines: DocLine[]; showVat?: boolean }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>SKU</TableHead>
          <TableHead>Ürün</TableHead>
          <TableHead className="text-right">Miktar</TableHead>
          <TableHead className="text-right">Birim fiyat</TableHead>
          {showVat ? <TableHead className="text-right">KDV %</TableHead> : null}
          {showVat ? <TableHead className="text-right">KDV</TableHead> : null}
          <TableHead className="text-right">Tutar</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {lines.map((line) => (
          <TableRow key={line.id}>
            <TableCell className="font-medium">{line.sku}</TableCell>
            <TableCell>{line.name}</TableCell>
            <TableCell className="text-right">
              <Qty value={line.quantity} unit={line.unit} />
            </TableCell>
            <TableCell className="text-right">
              <Money value={line.unitPrice} />
            </TableCell>
            {showVat ? (
              <TableCell className="text-right tabular-nums">{line.vatRate ?? 0}</TableCell>
            ) : null}
            {showVat ? (
              <TableCell className="text-right">
                <Money value={line.vatAmount ?? 0} />
              </TableCell>
            ) : null}
            <TableCell className="text-right font-medium">
              <Money value={line.lineTotal} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function TotalBox({
  subtotal,
  vatTotal,
  total,
  paid,
}: {
  subtotal?: number;
  vatTotal?: number;
  total: number;
  paid?: number;
}) {
  const remaining = paid === undefined ? undefined : total - paid;
  return (
    <div className="ml-auto w-full max-w-xs space-y-1 px-3 py-3 text-sm">
      {subtotal !== undefined ? (
        <div className="flex justify-between">
          <span className="text-muted-foreground">Ara toplam</span>
          <Money value={subtotal} />
        </div>
      ) : null}
      {vatTotal !== undefined ? (
        <div className="flex justify-between">
          <span className="text-muted-foreground">KDV</span>
          <Money value={vatTotal} />
        </div>
      ) : null}
      <div className="flex justify-between">
        <span className="text-muted-foreground">Toplam</span>
        <Money value={total} className="font-semibold" />
      </div>
      {paid !== undefined ? (
        <>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Ödenen</span>
            <Money value={paid} />
          </div>
          <div className="flex justify-between border-t pt-1">
            <span>Kalan</span>
            <Money value={remaining ?? 0} className="font-semibold" />
          </div>
        </>
      ) : null}
      <p className="pt-1 text-xs text-muted-foreground">
        {subtotal !== undefined || vatTotal !== undefined
          ? "Toplam KDV dahildir."
          : "Tutarlar KDV hariçtir."}
      </p>
    </div>
  );
}

export const fieldClass =
  "h-8 w-full rounded-lg border border-input bg-card px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
