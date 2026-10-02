"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fieldClass } from "@/components/erp";
import { todayInput } from "@/lib/dates";
import { createDeliveryNoteAction, type ActionState } from "@/server/actions";

const initial: ActionState = { error: null };

export function DeliveryNoteCreateForm({
  customers,
  suppliers,
  products,
  warehouses,
}: {
  customers: { id: string; code: string; name: string }[];
  suppliers: { id: string; code: string; name: string }[];
  products: { id: string; sku: string; name: string }[];
  warehouses: { id: string; code: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(createDeliveryNoteAction, initial);
  const [direction, setDirection] = useState("SALES");
  const parties = direction === "SALES" ? customers : suppliers;
  return (
    <form action={action} className="grid max-w-3xl gap-3">
      {state.error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span>Yön</span>
          <select
            name="direction"
            className={fieldClass}
            value={direction}
            onChange={(e) => setDirection(e.target.value)}
          >
            <option value="SALES">Satış</option>
            <option value="PURCHASE">Alış</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span>Cari</span>
          <select name="partyId" className={fieldClass} defaultValue={parties[0]?.id}>
            {parties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} · {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span>Depo</span>
          <select name="warehouseId" className={fieldClass} defaultValue={warehouses[0]?.id}>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.code} · {w.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span>Tarih</span>
          <Input type="date" name="date" defaultValue={todayInput()} required />
        </label>
      </div>
      <label className="grid gap-1 text-sm">
        <span>Ürün</span>
        <select name="productId" className={fieldClass} defaultValue={products[0]?.id}>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.sku} · {p.name}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        <span>Miktar</span>
        <Input name="quantity" defaultValue="1" required />
      </label>
      <label className="grid gap-1 text-sm">
        <span>Not</span>
        <Input name="notes" />
      </label>
      <Button type="submit" disabled={pending}>
        {pending ? "Kaydediliyor…" : "Kaydet"}
      </Button>
    </form>
  );
}
