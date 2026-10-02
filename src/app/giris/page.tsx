import { COMPANY } from "@/lib/demo";
import { LoginForm } from "@/app/giris/login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ hata?: string }>;
}) {
  const { hata } = await searchParams;
  return (
    <main className="grid min-h-screen lg:grid-cols-[280px_1fr]">
      <section className="hidden flex-col justify-between bg-sidebar px-6 py-8 text-sidebar-foreground lg:flex">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.18em] text-sidebar-primary uppercase">
            Ticari ERP
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">{COMPANY.short}</h1>
          <p className="mt-2 text-sm text-sidebar-foreground/75">{COMPANY.name}</p>
        </div>
        <p className="text-sm leading-6 text-sidebar-foreground/70">
          Cari, stok, satış faturası, mal kabul ve tahsilat tek defterde. Kayıtlar bu makinedeki
          veritabanında durur.
        </p>
      </section>
      <section className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md rounded-2xl bg-card p-6 ring-1 ring-foreground/10">
          <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase lg:hidden">
            {COMPANY.name}
          </p>
          <h2 className="text-xl font-semibold">Oturum açın</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Yetkili hesabınızla giriş yapın. Demo hesap bilgisi README dosyasındadır.
          </p>
          {hata ? (
            <p role="alert" className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {hata}
            </p>
          ) : null}
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
