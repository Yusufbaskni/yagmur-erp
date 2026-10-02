"use client";

import { useActionState, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fieldClass } from "@/components/erp";
import { addDaysInput, todayInput } from "@/lib/dates";
import { formatMoney, kurusToInput, milliToInput } from "@/lib/format";
import { UNITS, VAT_RATES, paymentMethodLabel } from "@/lib/labels";
import type { ActionState } from "@/server/actions";

const initialState: ActionState = { error: null };

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      {children}
    </label>
  );
}

function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {message}
    </p>
  );
}

export function PartyForm({
  action,
  initial,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  initial?: {
    id?: string;
    type: "CUSTOMER" | "SUPPLIER";
    code?: string;
    name: string;
    taxNumber?: string | null;
    taxOffice?: string | null;
    phone?: string | null;
    email?: string | null;
    city?: string | null;
    address?: string | null;
    notes?: string | null;
    active?: boolean;
  };
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  return (
    <form action={formAction} className="grid max-w-3xl gap-4">
      <FormError message={state.error} />
      {initial?.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tür">
          <select name="type" defaultValue={initial?.type ?? "CUSTOMER"} className={fieldClass} required>
            <option value="CUSTOMER">Müşteri</option>
            <option value="SUPPLIER">Tedarikçi</option>
          </select>
        </Field>
        <Field label={initial?.id ? "Kod" : "Kod (boşsa otomatik)"}>
          <Input name="code" defaultValue={initial?.code ?? ""} />
        </Field>
        <Field label="Ünvan">
          <Input name="name" defaultValue={initial?.name ?? ""} required />
        </Field>
        <Field label="Şehir">
          <Input name="city" defaultValue={initial?.city ?? ""} />
        </Field>
        <Field label="Vergi numarası">
          <Input name="taxNumber" defaultValue={initial?.taxNumber ?? ""} />
        </Field>
        <Field label="Vergi dairesi">
          <Input name="taxOffice" defaultValue={initial?.taxOffice ?? ""} />
        </Field>
        <Field label="Telefon">
          <Input name="phone" defaultValue={initial?.phone ?? ""} />
        </Field>
        <Field label="E-posta">
          <Input name="email" type="email" defaultValue={initial?.email ?? ""} />
        </Field>
      </div>
      <Field label="Adres">
        <textarea name="address" defaultValue={initial?.address ?? ""} className={`${fieldClass} h-20 py-2`} />
      </Field>
      <Field label="Not">
        <textarea name="notes" defaultValue={initial?.notes ?? ""} className={`${fieldClass} h-20 py-2`} />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" value="on" defaultChecked={initial?.active ?? true} className="size-4 accent-primary" />
        Aktif
      </label>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Kaydediliyor…" : "Kaydet"}
        </Button>
      </div>
    </form>
  );
}

export function ProductForm({
  action,
  warehouses,
  initial,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  warehouses?: { id: string; code: string; name: string }[];
  initial?: {
    id?: string;
    sku: string;
    barcode?: string | null;
    name: string;
    unit: string;
    salePrice: string;
    purchasePrice: string;
    vatRate?: number;
    minStock: string;
    trackSerial?: boolean;
    trackLot?: boolean;
    active?: boolean;
  };
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  return (
    <form action={formAction} className="grid max-w-3xl gap-4">
      <FormError message={state.error} />
      {initial?.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="SKU">
          <Input name="sku" defaultValue={initial?.sku ?? ""} required />
        </Field>
        <Field label="Barkod">
          <Input name="barcode" defaultValue={initial?.barcode ?? ""} />
        </Field>
        <Field label="Ürün adı">
          <Input name="name" defaultValue={initial?.name ?? ""} required />
        </Field>
        <Field label="Birim">
          <select name="unit" defaultValue={initial?.unit ?? "Adet"} className={fieldClass}>
            {UNITS.map((unit) => (
              <option key={unit}>{unit}</option>
            ))}
          </select>
        </Field>
        <Field label="Satış fiyatı (TL, KDV hariç)">
          <Input name="salePrice" defaultValue={initial?.salePrice ?? ""} inputMode="decimal" required />
        </Field>
        <Field label="Alış fiyatı (TL, KDV hariç)">
          <Input name="purchasePrice" defaultValue={initial?.purchasePrice ?? ""} inputMode="decimal" required />
        </Field>
        <Field label="KDV %">
          <select name="vatRate" defaultValue={String(initial?.vatRate ?? 20)} className={fieldClass}>
            {VAT_RATES.map((rate) => (
              <option key={rate} value={rate}>
                %{rate}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Asgari stok">
          <Input name="minStock" defaultValue={initial?.minStock ?? "0"} inputMode="decimal" />
        </Field>
        {initial?.id ? null : (
          <>
            <Field label="Açılış stoku">
              <Input name="openingStock" defaultValue="0" inputMode="decimal" />
            </Field>
            {warehouses && warehouses.length > 0 ? (
              <Field label="Açılış deposu">
                <select name="warehouseId" defaultValue={warehouses[0]?.id} className={fieldClass}>
                  {warehouses.map((wh) => (
                    <option key={wh.id} value={wh.id}>
                      {wh.code} · {wh.name}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}
          </>
        )}
      </div>
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="active" value="on" defaultChecked={initial?.active ?? true} className="size-4 accent-primary" />
          Aktif
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="trackLot" value="on" defaultChecked={initial?.trackLot ?? false} className="size-4 accent-primary" />
          Lot takibi
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="trackSerial" value="on" defaultChecked={initial?.trackSerial ?? false} className="size-4 accent-primary" />
          Seri no takibi
        </label>
      </div>
      <p className="text-xs text-muted-foreground">
        Fiyatlar KDV hariçtir. Belge satırlarında KDV hesaplanır. Stok açılış ve hareketlerle değişir.
      </p>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Kaydediliyor…" : "Kaydet"}
        </Button>
      </div>
    </form>
  );
}

type CatalogProduct = {
  id: string;
  sku: string;
  barcode?: string | null;
  name: string;
  unit: string;
  salePrice: number;
  purchasePrice: number;
  vatRate?: number;
  stockOnHand: number;
  stockReserved?: number;
};

function priceOf(product: CatalogProduct | undefined, mode: "sale" | "purchase") {
  if (!product) return "";
  return kurusToInput(mode === "sale" ? product.salePrice : product.purchasePrice);
}

export function DocumentForm({
  action,
  parties,
  products,
  warehouses,
  price,
  submitLabel,
  initial,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  parties: { id: string; code: string; name: string }[];
  products: CatalogProduct[];
  warehouses?: { id: string; code: string; name: string }[];
  price: "sale" | "purchase";
  submitLabel: string;
  initial?: {
    id?: string;
    partyId: string;
    warehouseId?: string;
    date: string;
    notes?: string | null;
    lines: { productId: string; quantity: string; unitPrice: string; vatRate?: string }[];
  };
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [barcode, setBarcode] = useState("");
  const [lines, setLines] = useState(() => {
    const seed = initial?.lines?.length
      ? initial.lines
      : [
          {
            productId: products[0]?.id ?? "",
            quantity: "1",
            unitPrice: priceOf(products[0], price),
            vatRate: String(products[0]?.vatRate ?? 20),
          },
        ];
    return seed.map((line) => ({
      vatRate: String(line.vatRate ?? products.find((p) => p.id === line.productId)?.vatRate ?? 20),
      ...line,
      key: crypto.randomUUID(),
    }));
  });

  function update(key: string, patch: Partial<(typeof lines)[number]>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  function addByBarcode() {
    const code = barcode.trim();
    if (!code) return;
    const product =
      products.find((p) => p.barcode === code) ||
      products.find((p) => p.sku.toLowerCase() === code.toLowerCase());
    if (!product) return;
    setLines((current) => [
      ...current,
      {
        key: crypto.randomUUID(),
        productId: product.id,
        quantity: "1",
        unitPrice: priceOf(product, price),
        vatRate: String(product.vatRate ?? 20),
      },
    ]);
    setBarcode("");
  }

  return (
    <form action={formAction} className="grid gap-4">
      <FormError message={state.error} />
      {initial?.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label={price === "sale" ? "Müşteri" : "Tedarikçi"}>
          <select name="partyId" defaultValue={initial?.partyId ?? parties[0]?.id} className={fieldClass} required>
            {parties.map((party) => (
              <option key={party.id} value={party.id}>
                {party.code} · {party.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tarih">
          <Input type="date" name="date" defaultValue={initial?.date ?? todayInput()} required />
        </Field>
        {warehouses && warehouses.length > 0 ? (
          <Field label="Depo">
            <select
              name="warehouseId"
              defaultValue={initial?.warehouseId ?? warehouses[0]?.id}
              className={fieldClass}
            >
              {warehouses.map((wh) => (
                <option key={wh.id} value={wh.id}>
                  {wh.code} · {wh.name}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[200px] flex-1">
          <Field label="Barkod / SKU ile satır ekle">
            <Input
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addByBarcode();
                }
              }}
              placeholder="Barkod okutun"
            />
          </Field>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addByBarcode}>
          Ekle
        </Button>
      </div>
      <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-muted/70 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Ürün</th>
              <th className="px-3 py-2 font-medium">Miktar</th>
              <th className="px-3 py-2 font-medium">Birim fiyat</th>
              <th className="px-3 py-2 font-medium">KDV %</th>
              <th className="w-16 px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => {
              const product = products.find((item) => item.id === line.productId);
              const available =
                (product?.stockOnHand ?? 0) - (product?.stockReserved ?? 0);
              return (
                <tr key={line.key} className="border-t">
                  <td className="px-3 py-2">
                    <select
                      name="productId"
                      value={line.productId}
                      className={fieldClass}
                      onChange={(event) => {
                        const next = products.find((item) => item.id === event.target.value);
                        update(line.key, {
                          productId: event.target.value,
                          unitPrice: priceOf(next, price),
                          vatRate: String(next?.vatRate ?? 20),
                        });
                      }}
                    >
                      {products.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.sku} · {item.name}
                          {item.barcode ? ` · ${item.barcode}` : ""}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Kullanılabilir {product ? milliToInput(available) : "0"} {product?.unit}
                    </p>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <Input
                      name="quantity"
                      value={line.quantity}
                      inputMode="decimal"
                      onChange={(event) => update(line.key, { quantity: event.target.value })}
                    />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <Input
                      name="unitPrice"
                      value={line.unitPrice}
                      inputMode="decimal"
                      onChange={(event) => update(line.key, { unitPrice: event.target.value })}
                    />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <select
                      name="vatRate"
                      value={line.vatRate}
                      className={fieldClass}
                      onChange={(event) => update(line.key, { vatRate: event.target.value })}
                    >
                      {VAT_RATES.map((rate) => (
                        <option key={rate} value={rate}>
                          {rate}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={lines.length === 1}
                      onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}
                    >
                      Sil
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            setLines((current) => [
              ...current,
              {
                key: crypto.randomUUID(),
                productId: products[0]?.id ?? "",
                quantity: "1",
                unitPrice: priceOf(products[0], price),
                vatRate: String(products[0]?.vatRate ?? 20),
              },
            ])
          }
        >
          Satır ekle
        </Button>
      </div>
      <Field label="Not">
        <textarea name="notes" defaultValue={initial?.notes ?? ""} className={`${fieldClass} h-20 py-2`} />
      </Field>
      <div>
        <Button type="submit" disabled={pending || parties.length === 0 || products.length === 0}>
          {pending ? "Kaydediliyor…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}

export function MovementForm({
  action,
  products,
  warehouses,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  products: CatalogProduct[];
  warehouses?: { id: string; code: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [kind, setKind] = useState("IN");
  return (
    <form action={formAction} className="grid max-w-xl gap-4">
      <FormError message={state.error} />
      <Field label="Tür">
        <select name="kind" value={kind} onChange={(event) => setKind(event.target.value)} className={fieldClass}>
          <option value="IN">Giriş</option>
          <option value="OUT">Çıkış</option>
          <option value="ADJUSTMENT">Sayım düzeltmesi</option>
        </select>
      </Field>
      {warehouses && warehouses.length > 0 ? (
        <Field label="Depo">
          <select name="warehouseId" className={fieldClass} defaultValue={warehouses[0]?.id}>
            {warehouses.map((wh) => (
              <option key={wh.id} value={wh.id}>
                {wh.code} · {wh.name}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
      <Field label="Ürün">
        <select name="productId" className={fieldClass} defaultValue={products[0]?.id}>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.sku} · {product.name} · stok {milliToInput(product.stockOnHand)}
            </option>
          ))}
        </select>
      </Field>
      <Field label={kind === "ADJUSTMENT" ? "Sayılan miktar" : "Miktar"}>
        <Input name="quantity" inputMode="decimal" required />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Lot (opsiyonel)">
          <Input name="lotCode" />
        </Field>
        <Field label="Seri no (opsiyonel)">
          <Input name="serialCode" />
        </Field>
      </div>
      <Field label="Tarih">
        <Input type="date" name="date" defaultValue={todayInput()} required />
      </Field>
      <Field label="Açıklama">
        <Input name="note" />
      </Field>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Kaydediliyor…" : "Hareketi kaydet"}
        </Button>
      </div>
    </form>
  );
}

type OpenDoc = {
  id: string;
  partyId: string;
  number: string;
  remaining: number;
  dateLabel: string;
};

function inputKurus(raw: string) {
  const value = raw.trim();
  if (!value) return 0;
  const normalized = value.includes(",") ? value.replace(/\./g, "").replace(",", ".") : value;
  if (!/^\d+(\.\d{0,2})?$/.test(normalized)) return null;
  const [lira, frac = ""] = normalized.split(".");
  return Number(lira) * 100 + Number(frac.padEnd(2, "0").slice(0, 2));
}

export function PaymentForm({
  action,
  parties,
  documents,
  noun,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  parties: { id: string; code: string; name: string }[];
  documents: OpenDoc[];
  noun: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [partyId, setPartyId] = useState(parties[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [applied, setApplied] = useState<Record<string, string>>({});
  const docs = useMemo(
    () => documents.filter((doc) => doc.partyId === partyId),
    [documents, partyId],
  );
  const appliedSum = docs.reduce((sum, doc) => sum + (inputKurus(applied[doc.id] ?? "") ?? 0), 0);
  const amountKurus = inputKurus(amount);

  function distribute() {
    if (amountKurus === null) return;
    let left = amountKurus;
    const next: Record<string, string> = {};
    for (const doc of docs) {
      if (left <= 0) break;
      const use = Math.min(doc.remaining, left);
      if (use > 0) next[doc.id] = kurusToInput(use);
      left -= use;
    }
    setApplied(next);
  }

  return (
    <form action={formAction} className="grid max-w-3xl gap-4">
      <FormError message={state.error} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Cari">
          <select
            name="partyId"
            value={partyId}
            className={fieldClass}
            onChange={(event) => {
              setPartyId(event.target.value);
              setApplied({});
            }}
          >
            {parties.map((party) => (
              <option key={party.id} value={party.id}>
                {party.code} · {party.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tarih">
          <Input type="date" name="date" defaultValue={todayInput()} required />
        </Field>
        <Field label="Yöntem">
          <select name="method" defaultValue="BANK" className={fieldClass}>
            {Object.entries(paymentMethodLabel).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tutar (TL)">
          <Input name="amount" value={amount} inputMode="decimal" onChange={(event) => setAmount(event.target.value)} required />
        </Field>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Açık {noun}</p>
        <Button type="button" variant="outline" size="sm" onClick={distribute}>
          Tutarı belgelere dağıt
        </Button>
      </div>
      {docs.length === 0 ? (
        <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
          Bu caride açık belge yok.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
          <table className="w-full text-sm">
            <thead className="bg-muted/70 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Belge</th>
                <th className="px-3 py-2 font-medium">Tarih</th>
                <th className="px-3 py-2 text-right font-medium">Kalan</th>
                <th className="px-3 py-2 font-medium">Uygulanan</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((doc) => (
                <tr key={doc.id} className="border-t">
                  <td className="px-3 py-2 font-medium">{doc.number}</td>
                  <td className="px-3 py-2">{doc.dateLabel}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMoney(doc.remaining)}</td>
                  <td className="px-3 py-2">
                    <input type="hidden" name="allocDocId" value={doc.id} />
                    <Input
                      name="allocAmount"
                      inputMode="decimal"
                      value={applied[doc.id] ?? ""}
                      placeholder="0,00"
                      onChange={(event) =>
                        setApplied((current) => ({ ...current, [doc.id]: event.target.value }))
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-sm">
        Dağıtılan: <span className="font-medium tabular-nums">{formatMoney(appliedSum)}</span>
        {amountKurus !== null ? (
          <span className="text-muted-foreground"> · fiş {formatMoney(amountKurus)}</span>
        ) : (
          <span className="text-destructive"> · tutar okunamadı</span>
        )}
      </p>
      <Field label="Not">
        <Input name="notes" />
      </Field>
      <p className="text-xs text-muted-foreground">
        Tutar, açık belgelere dağıtılan toplamla aynı olmalı. Kalan bakiyenin üstüne çıkılamaz. Vade önerisi {addDaysInput(0)}.
      </p>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Kaydediliyor…" : "Kaydet"}
        </Button>
      </div>
    </form>
  );
}

export function DueForm({
  action,
  id,
  label,
  withDue = true,
}: {
  action: (formData: FormData) => Promise<void>;
  id: string;
  label: string;
  withDue?: boolean;
}) {
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="id" value={id} />
      <label className="grid gap-1 text-xs">
        <span>Tarih</span>
        <Input type="date" name="date" defaultValue={todayInput()} required className="w-40" />
      </label>
      {withDue ? (
        <label className="grid gap-1 text-xs">
          <span>Vade</span>
          <Input type="date" name="dueDate" defaultValue={addDaysInput(14)} required className="w-40" />
        </label>
      ) : null}
      <Button type="submit">{label}</Button>
    </form>
  );
}

export function ReceiveForm({
  action,
  id,
  label,
}: {
  action: (formData: FormData) => Promise<void>;
  id: string;
  label: string;
}) {
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="id" value={id} />
      <label className="grid gap-1 text-xs">
        <span>Tarih</span>
        <Input type="date" name="date" defaultValue={todayInput()} required className="w-40" />
      </label>
      <label className="grid gap-1 text-xs">
        <span>Not</span>
        <Input name="notes" className="w-56" />
      </label>
      <Button type="submit">{label}</Button>
    </form>
  );
}

export function PostButton({
  action,
  id,
  label,
  variant = "default",
}: {
  action: (formData: FormData) => Promise<void>;
  id: string;
  label: string;
  variant?: "default" | "outline" | "destructive" | "secondary";
}) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <Button type="submit" size="sm" variant={variant}>
        {label}
      </Button>
    </form>
  );
}
