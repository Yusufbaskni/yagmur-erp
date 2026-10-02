"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fieldClass } from "@/components/erp";
import { createBomAction, type ActionState } from "@/server/actions";
const initial: ActionState = { error: null };
export function BomCreateForm({ products }: { products: { id: string; sku: string; name: string }[] }) {
  const [state, action, pending] = useActionState(createBomAction, initial);
  return (
    <form action={action} className="grid max-w-xl gap-3">
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <Input name="code" placeholder="Kod" required />
      <Input name="name" placeholder="Ad" required />
      <select name="finishedProductId" className={fieldClass} defaultValue={products[0]?.id}>
        {products.map(p => <option key={p.id} value={p.id}>{p.sku} · {p.name}</option>)}
      </select>
      <Input name="outputQty" defaultValue="1" placeholder="Çıktı miktarı" />
      <select name="componentId" className={fieldClass} defaultValue={products[1]?.id ?? products[0]?.id}>
        {products.map(p => <option key={p.id} value={p.id}>{p.sku} · {p.name}</option>)}
      </select>
      <Input name="componentQty" defaultValue="1" />
      <Button type="submit" disabled={pending}>Kaydet</Button>
    </form>
  );
}
