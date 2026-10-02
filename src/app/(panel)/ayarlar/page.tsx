import fs from "node:fs";
import path from "node:path";
import { ErrorNote, LinkButton, Money, PageHeader, Panel, fieldClass } from "@/components/erp";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { exportBackupAction, importBackupAction } from "@/server/actions";
import { getActiveCompany } from "@/server/company";
import { listCurrencyRates, listMoneyAccounts, listWarehouses } from "@/server/queries";

export const metadata = { title: "Ayarlar" };

function listBackupFiles() {
  const dir = path.join(process.cwd(), "prisma", "backups");
  if (!fs.existsSync(dir)) return [] as string[];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".db"))
    .sort()
    .reverse();
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ hata?: string; yedek?: string; ok?: string }>;
}) {
  const { hata, yedek, ok } = await searchParams;
  const [{ company, actor }, warehouses, currencies, accounts] = await Promise.all([
    getActiveCompany(),
    listWarehouses(),
    listCurrencyRates(),
    listMoneyAccounts(),
  ]);
  const canBackup = actor.role === "ADMIN";
  const backups = canBackup ? listBackupFiles() : [];
  return (
    <div>
      <PageHeader
        title="Ayarlar"
        description="Şirket özeti, e-Fatura sandbox, yedekleme."
        actions={<LinkButton href="/ayarlar/denetim" variant="outline">Denetim kaydı</LinkButton>}
      />
      <ErrorNote message={hata} />
      {yedek ? (
        <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Yedek alındı: {yedek}
        </p>
      ) : null}
      {ok === "restore" ? (
        <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Yedek geri yüklendi.
        </p>
      ) : null}

      <Panel className="mb-4 p-4">
        <h2 className="text-sm font-semibold">Şirket</h2>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Kod</dt>
            <dd className="font-medium">{company.code}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Ünvan</dt>
            <dd className="font-medium">{company.name}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Kısa ad</dt>
            <dd className="font-medium">{company.shortName}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Vergi no / şehir</dt>
            <dd className="font-medium">
              {[company.taxNumber, company.city].filter(Boolean).join(" · ") || "—"}
            </dd>
          </div>
        </dl>
      </Panel>

      <Panel className="mb-4 p-4">
        <h2 className="text-sm font-semibold">e-Fatura (sandbox)</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Canlı GİB / özel entegratör bağlantısı yoktur; tüm gönderim mock’tur.</li>
          <li>Yalnızca satış faturalarından giden e-Fatura oluşturulur.</li>
          <li>Aynı fatura için reddedilmemiş ikinci e-Fatura açılamaz.</li>
          <li>Taslak → sandbox gönder → kabul/red simülasyonu sırası izlenir.</li>
          <li>Üretilen UBL XML yerel kayıttır; resmi geçerlilik yoktur.</li>
        </ul>
      </Panel>

      <Panel className="mb-4 p-4">
        <h2 className="text-sm font-semibold">Bilinçli sınırlar</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>İK kaydı vardır; Türk bordro, SGK ve işveren bildirimi yoktur.</li>
          <li>Yevmiye operasyonel izdir; resmi muhasebe defteri iddiası yoktur.</li>
          <li>Stok hareketlerinde ürün toplamı ile depo satırları işlem sonunda karşılaştırılır.</li>
          <li>Masaüstü Swift kabuğudur; Apple Developer imzası / App Store dağıtımı yoktur.</li>
        </ul>
      </Panel>

      <div className="mb-4 grid gap-4 xl:grid-cols-2">
        <Panel className="p-4">
          <h2 className="text-sm font-semibold">Depolar</h2>
          {warehouses.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Depo yok.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kod</TableHead>
                  <TableHead>Ad</TableHead>
                  <TableHead className="text-right">Kalem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {warehouses.map((wh) => (
                  <TableRow key={wh.id}>
                    <TableCell className="font-medium">{wh.code}</TableCell>
                    <TableCell>
                      {wh.name}
                      {wh.isDefault ? " · varsayılan" : ""}
                    </TableCell>
                    <TableCell className="text-right">{wh.stocks.length}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Detay için sol menüden Depolar sayfasına gidin.
          </p>
        </Panel>
        <Panel className="p-4">
          <h2 className="text-sm font-semibold">Döviz kurları</h2>
          {currencies.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Kur kaydı yok.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kod</TableHead>
                  <TableHead>Ad</TableHead>
                  <TableHead>Tarih</TableHead>
                  <TableHead className="text-right">Kur (kuruş)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currencies.slice(0, 12).map((rate) => (
                  <TableRow key={rate.id}>
                    <TableCell className="font-medium">{rate.code}</TableCell>
                    <TableCell>{rate.name}</TableCell>
                    <TableCell>{formatDate(rate.asOfDate)}</TableCell>
                    <TableCell className="text-right">
                      <Money value={rate.rateToTry} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <h2 className="mt-4 text-sm font-semibold">Kasa / banka özeti</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {accounts.map((acc) => (
              <li key={acc.id} className="flex justify-between gap-2">
                <span>
                  {acc.code} · {acc.name}
                </span>
                <Money value={acc.balance} />
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel className="p-4">
        <h2 className="text-sm font-semibold">Yedekleme</h2>
        {canBackup ? (
          <>
            <p className="mt-1 text-sm text-muted-foreground">
              SQLite veritabanı kopyası `prisma/backups` altına alınır. Geri yükleme mevcut dosyayı
              değiştirir. Yalnızca yönetici yapabilir.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <form action={exportBackupAction}>
                <Button type="submit" size="sm">
                  Yedek al
                </Button>
              </form>
            </div>
            {backups.length > 0 ? (
              <form action={importBackupAction} className="mt-4 flex flex-wrap items-end gap-2">
                <label className="grid gap-1 text-xs">
                  <span>Geri yüklenecek dosya</span>
                  <select name="backupFile" className={fieldClass} defaultValue={backups[0]}>
                    {backups.map((file) => (
                      <option key={file} value={file}>
                        {file}
                      </option>
                    ))}
                  </select>
                </label>
                <Button type="submit" size="sm" variant="outline">
                  Geri yükle
                </Button>
              </form>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">Henüz yedek yok.</p>
            )}
          </>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">
            Yedek alma ve geri yükleme yalnızca yöneticiye açıktır.
          </p>
        )}
      </Panel>
    </div>
  );
}
