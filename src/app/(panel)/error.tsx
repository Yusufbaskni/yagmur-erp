"use client";

import { Button } from "@/components/ui/button";

export default function PanelError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="max-w-lg rounded-xl bg-card p-5 ring-1 ring-foreground/10">
      <h1 className="text-lg font-semibold">Ekran açılamadı</h1>
      <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      <Button type="button" className="mt-4" onClick={reset}>
        Yeniden dene
      </Button>
    </div>
  );
}
