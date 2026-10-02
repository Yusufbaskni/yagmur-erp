"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fieldClass } from "@/components/erp";
import { todayInput } from "@/lib/dates";
import { createTransferAction, type ActionState } from "@/server/actions";

const initial: ActionState = { error: null };

export function TransferForm({
  warehouses,
  products,
}: {
  warehouses: { id: string; code: string; name: string }[];
  products: { id: string; sku: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(createTransferAction, initial);
  const [lines, setLines] = useState([
    { key: crypto.randomUUID(), productId: products[0]?.id ?? "", quantity: "1" },
  ]);
  return (
    <form action={action} className="grid gap-3">
      {state.error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="grid gap-1 text-sm">
          <span>Kaynak depo</span>
          <select name="fromWarehouseId" className={fieldClass} defaultValue={warehouses[0]?.id}>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.code} · {w.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span>Hedef depo</span>
          <select name="toWarehouseId" className={fieldClass} defaultValue={warehouses[1]?.id ?? warehouses[0]?.id}>
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
      {lines.map((line) => (
        <div key={line.key} className="grid gap-2 sm:grid-cols-[1fr_120px]">
          <select
            name="productId"
            className={fieldClass}
            value={line.productId}
            onChange={(e) =>
              setLines((cur) =>
                cur.map((l) => (l.key === line.key ? { ...l, productId: e.target.value } : l)),
              )
            }
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.sku} · {p.name}
              </option>
            ))}
          </select>
          <Input
            name="quantity"
            value={line.quantity}
            onChange={(e) =>
              setLines((cur) =>
                cur.map((l) => (l.key === line.key ? { ...l, quantity: e.target.value } : l)),
              )
            }
          />
        </div>
      ))}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            setLines((cur) => [
              ...cur,
              { key: crypto.randomUUID(), productId: products[0]?.id ?? "", quantity: "1" },
            ])
          }
        >
          Satır ekle
        </Button>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Kaydediliyor…" : "Transfer et"}
        </Button>
      </div>
    </form>
  );
}
