"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loginAction, type ActionState } from "@/server/actions";

const initial: ActionState = { error: null };

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initial);
  return (
    <form action={action} className="mt-5 grid gap-3">
      {state.error ? (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <label className="grid gap-1.5 text-sm">
        <span className="font-medium">E-posta</span>
        <Input name="email" type="email" autoComplete="username" placeholder="ornek@firma.com" required />
      </label>
      <label className="grid gap-1.5 text-sm">
        <span className="font-medium">Şifre</span>
        <Input name="password" type="password" autoComplete="current-password" required />
      </label>
      <Button type="submit" disabled={pending} className="mt-1">
        {pending ? "Giriş yapılıyor…" : "Giriş yap"}
      </Button>
    </form>
  );
}
