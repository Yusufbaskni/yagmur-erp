"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fieldClass } from "@/components/erp";
import { addDaysInput } from "@/lib/dates";
import { createCheckAction, type ActionState } from "@/server/actions";
const initial: ActionState = { error: null };
export function CheckCreateForm({ parties, moneyAccounts }: {
  parties: { id: string; code: string; name: string }[];
  moneyAccounts: { id: string; code: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(createCheckAction, initial);
  return (
    <form action={action} className="grid max-w-xl gap-3">
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <select name="kind" className={fieldClass} defaultValue="CHECK">
        <option value="CHECK">Çek</option>
        <option value="PROMISSORY">Senet</option>
      </select>
      <select name="partyId" className={fieldClass}>
        <option value="">Cari (opsiyonel)</option>
        {parties.map(p => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
      </select>
      <select name="moneyAccountId" className={fieldClass}>
        <option value="">Hesap (opsiyonel)</option>
        {moneyAccounts.map(a => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}
      </select>
      <Input type="date" name="dueDate" defaultValue={addDaysInput(30)} required />
      <Input name="amount" placeholder="Tutar" required />
      <Input name="bankName" placeholder="Banka" />
      <Input name="serialNo" placeholder="Seri no" />
      <Input name="notes" placeholder="Not" />
      <Button type="submit" disabled={pending}>{pending ? "…" : "Kaydet"}</Button>
    </form>
  );
}
