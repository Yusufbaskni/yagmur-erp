import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">404</p>
      <h1 className="mt-2 text-2xl font-semibold">Kayıt bulunamadı</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Aradığınız belge silinmiş veya numarası değişmiş olabilir.
      </p>
      <Link href="/" className="mt-4 text-sm font-medium text-primary">
        Panele dön
      </Link>
    </main>
  );
}
