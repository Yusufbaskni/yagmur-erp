"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fieldClass } from "@/components/erp";
import { todayInput } from "@/lib/dates";
import { createWorkOrderAction, type ActionState } from "@/server/actions";
const initial: ActionState = { error: null };
export function WorkOrderCreateForm({ boms, warehouses }: {
  boms: { id: string; code: string; name: string }[];
  warehouses: { id: string; code: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(createWorkOrderAction, initial);
  return (
    <form action={action} className="grid max-w-xl gap-3">
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <select name="bomId" className={fieldClass} defaultValue={boms[0]?.id}>
        {boms.map(b => <option key={b.id} value={b.id}>{b.code} · {b.name}</option>)}
      </select>
      <select name="warehouseId" className={fieldClass} defaultValue={warehouses[0]?.id}>
        {warehouses.map(w => <option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}
      </select>
      <Input name="quantity" defaultValue="1" />
      <Input type="date" name="date" defaultValue={todayInput()} />
      <Input name="notes" placeholder="Not" />
      <Button type="submit" disabled={pending}>Kaydet</Button>
    </form>
  );
}
