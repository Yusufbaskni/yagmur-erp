# Yağmur ERP

Yağmur Gıda Ticaret için toptan/perakende operasyon uygulaması. Varsayılan para birimi TRY. Veriler yerelde SQLite dosyasında durur.

## Gereksinimler

- Node.js 22

## Kurulum

```bash
npm install
npx prisma migrate deploy
npm run db:seed
npm run dev
```

`npm run dev` migration’ı uygular, veritabanı boşsa demo verisini yükler ve uygulamayı [http://127.0.0.1:43123](http://127.0.0.1:43123) adresinde açar.

Veriyi sıfırlamak:

```bash
npm run db:reset
```

## Demo giriş

- E-posta: `demo@yagmurgida.com`
- Şifre: `Yagmur2026`
- Şirketler: Yağmur Gıda Ticaret (ana) ve hafif ikinci şirket Deneme Gıda

## Bu sürümde eklenenler

### Ticaret / belgeler
- KDV motoru (ürün/satır oranı, fatura toplamları, satış/alış KDV raporu)
- Satış ve alış iade faturaları (stok ve bakiye ters kayıt)
- Alış faturası mal kabulden ayrı; mal kabul → alış faturası bağlantısı
- Onaylı satış siparişinde stok rezervasyonu; iptal/faturada serbest bırakma
- İrsaliye (satış/alış)
- Fiyat listesi ve indirim şablonu (sipariş/faturaya uygulanabilir)
- Çoklu depo, depo stoğu, transfer, belgelerde depo seçimi
- Ürün barkodu ve barkod/SKU ile satır ekleme
- Opsiyonel lot/seri takibi

### Finans
- Kasa/banka hesapları ve tahsilat-ödeme hareketleri
- Çek-senet defteri (portföy, tahsil, cirolu, karşılıksız)
- Belgede döviz + kur tablosu; orijinal tutar ve TRY karşılığı
- Hafif hesap planı ve fatura/ödemeden otomatik yevmiye (yasal defter değildir)

### Organizasyon
- Çoklu şirket ve şirket değiştirici (`companyId` kapsamı)
- Roller: yönetici, satış, satın alma, depo, muhasebe (server action kontrolleri)
- Denetim kaydı

### Diğer
- Üretim (temel): BOM, iş emri, bileşen tüketimi / mamul üretimi
- İK (temel): çalışan, departman, izin — **bordro/SGK değildir**
- CRM (temel): lead, fırsat/pipeline
- Ayarlardan SQLite yedek al/geri yükle
- Mobil uyumlu responsive kabuk
- e-Fatura: belge modeli, UBL benzeri XML, taslak → gönderildi → kabul/red, **sandbox/mock gönderici**

## Sınırlar (bilinçli)

- **e-Fatura:** Canlı GİB / özel entegratör yok. Sandbox mock’tur. Canlı için kimlik bilgileri gerekir.
- **İK:** Temel kayıt; Türk bordro, SGK, işveren bildirimi yoktur.
- **Yevmiye:** Operasyonel izlenebilirlik içindir; resmi Türk muhasebe defteri iddiası yoktur.
- **Masaüstü imza:** Apple imzalama / App Store dağıtımı yoktur.

## İş kuralları (özet)

- Satış siparişi onayında stok rezerve edilir; fatura rezervi bozup stoğu düşer.
- Mal kabul yalnızca stok girişi yapar. Tedarikçi borcu alış faturasıyla açılır.
- Satış/alış iadeleri stok ve bakiyeyi tersine çevirir.
- Eldeki (rezerv düşülmüş) stoktan fazla sevk/fatura yok.
- Belge tutarları KDV dahildir; satırda net + KDV + brüt tutulur.
- Tahsilat satış faturasına, ödeme alış faturasına uygulanır.

## Masaüstü

```bash
npm install
npm run desktop
```

Şema veya arayüz değişince:

```bash
npm run desktop:build
npm run desktop
```

Mac `.app` / `.dmg` üretimi için macOS gerekir:

```bash
npm run dist:mac
```

İmza aranmaz.

## Mac klasörü

Bu bulut ortamı `~/Projects/ERP` diskine yazamaz. Kaynak depo dalında gelişir. Mac makinede (self-hosted worker veya yerel klon) aynı branch’i çekip `npm install && npm run desktop` ile çalıştırın. Zip ile kopyalama gerekmez.

## Test

```bash
npm test
```

KDV toplamları, rezervasyon, iade, çoklu depo ve alış faturası/mal kabul ayrımı `tests/ledger.test.ts` içindedir.
