"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fieldClass } from "@/components/erp";
import { createEmployeeAction, type ActionState } from "@/server/actions";
const initial: ActionState = { error: null };
export function EmployeeCreateForm({ departments }: { departments: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(createEmployeeAction, initial);
  return (
    <form action={action} className="grid max-w-xl gap-3">
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <Input name="code" placeholder="Kod" required />
      <Input name="name" placeholder="Ad soyad" required />
      <select name="departmentId" className={fieldClass}>
        <option value="">Departman</option>
        {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
      </select>
      <Input name="title" placeholder="Ünvan" />
      <Input name="email" placeholder="E-posta" />
      <Input name="phone" placeholder="Telefon" />
      <Button type="submit" disabled={pending}>Kaydet</Button>
    </form>
  );
}
