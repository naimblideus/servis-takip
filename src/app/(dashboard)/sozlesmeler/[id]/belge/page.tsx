import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import YazdirBari from '@/components/YazdirBari';
import { oturumKullanicisi } from '@/lib/api-auth';
import { sozluk, doldur, dilMi, VARSAYILAN_DIL, type Dil } from '@/lib/i18n/sozluk';
import { bicimYap } from '@/lib/bicim';

/**
 * SÖZLEŞME EKİ — kiralanan cihazlar ve şartlar, imzaya hazır.
 *
 * ── NEDEN ────────────────────────────────────────────────────────────────
 * Kiralama sözleşmesinin değişen kısmı cihaz listesi ve fiyatlardır: makine
 * eklenir, değişir, zam gelir. Bayi her seferinde Word'de tabloyu elle
 * düzeltiyordu; tablo ile sistemdeki fiyat ayrışıyor, ay sonunda fatura
 * itirazı çıkıyordu. Bu ek sözleşme kaydından ve cihazlardan KENDİLİĞİNDEN
 * dolar: imzalanan kâğıt ile kesilen fatura aynı kaynaktan.
 *
 * Hukuki madde YAZMAZ: bayinin kendi sözleşme metnine eklenen bir EK'tir
 * (taraflar, süre, ihbar, yenileme, zam, servis süresi, cihaz ve fiyat
 * listesi, imza). Resmi belge biçimi: siyah-beyaz, serifli, her sayfada
 * paraf ve sayfa numarası.
 *
 * Kâğıt müşteriye veriliyor: dil ve para birimi BAYİDEN (fiş ve fatura gibi).
 */
export default async function SozlesmeBelgesiPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session) redirect('/login');
  const user = await oturumKullanicisi(session);
  if (!user) redirect('/login');

  const s = await prisma.contract.findFirst({
    where: { id, tenantId: user.tenantId },
    include: {
      tenant: { select: { name: true, address: true, city: true, district: true, phone: true, email: true, taxNumber: true, taxOffice: true, locale: true, currency: true, vatRate: true } },
      customer: { select: { name: true, legalName: true, address: true, city: true, district: true, phone: true, taxNo: true, taxOffice: true, contactPerson: true } },
      devices: {
        include: {
          device: {
            select: {
              brand: true, model: true, serialNo: true, location: true,
              monthlyRent: true, includedBlack: true, includedColor: true,
              pricePerBlack: true, pricePerColor: true, overagePriceBlack: true, overagePriceColor: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  if (!s) redirect('/sozlesmeler');

  const dil: Dil = dilMi(s.tenant.locale) ? s.tenant.locale : VARSAYILAN_DIL;
  const sz = sozluk(dil);
  const k = sz.sozlesmeBelgesi;
  const b = bicimYap(dil, s.tenant.currency);

  // Sözleşmede yazan şart; yazmıyorsa cihazın güncel ayarı (yıldızla işaretli):
  // faturayı kesen değer o. Uydurma yok — ikisi de yoksa "—".
  let sistemdenVar = false;
  const deger = (soz: unknown, cihaz: unknown): { v: number | null; sistem: boolean } => {
    if (soz !== null && soz !== undefined) return { v: Number(soz), sistem: false };
    if (cihaz !== null && cihaz !== undefined) { sistemdenVar = true; return { v: Number(cihaz), sistem: true }; }
    return { v: null, sistem: false };
  };
  const satirlar = s.devices.map((cd, i) => {
    const d = cd.device;
    const kira = deger(cd.monthlyRent, d.monthlyRent);
    return {
      no: i + 1,
      ad: `${d.brand} ${d.model}`,
      seri: d.serialNo,
      konum: d.location,
      kira,
      dahilS: deger(cd.includedBlack, d.includedBlack),
      dahilR: deger(cd.includedColor, d.includedColor),
      fiyatS: deger(cd.pricePerBlack, d.pricePerBlack),
      fiyatR: deger(cd.pricePerColor, d.pricePerColor),
      asimS: deger(cd.overagePriceBlack, d.overagePriceBlack),
      asimR: deger(cd.overagePriceColor, d.overagePriceColor),
    };
  });
  const toplamKira = satirlar.reduce((t, r) => t + (r.kira.v ?? 0), 0);

  const tarih = (d: Date) => b.tarih(d);
  const ayFarki = Math.max(0, Math.round((s.endDate.getTime() - s.startDate.getTime()) / (30.4375 * 86_400_000)));
  const sureMetni = (dk: number) => {
    const sa = Math.floor(dk / 60), kalan = dk % 60;
    return kalan ? doldur(k.saatDk, { s: sa, d: kalan }) : doldur(k.saat, { s: sa });
  };
  const para = (x: { v: number | null; sistem: boolean }, ondalik = 2) => x.v === null ? '—' : `${b.para(x.v, ondalik)}${x.sistem ? '*' : ''}`;
  const sayi = (x: { v: number | null; sistem: boolean }) => x.v === null ? '—' : `${b.sayi(x.v)}${x.sistem ? '*' : ''}`;
  const ikili = (a: string, c: string) => (c === '—' && a !== '—' ? a : `${a} / ${c}`);

  // Adres alanı ilçe/il'i zaten içeriyorsa ikinci kez eklenmez ("Ümraniye, İstanbul, Ümraniye, İstanbul").
  const adres = (a: string | null, ilce: string | null, il: string | null) => {
    const parca = [a, ilce, il].filter((x): x is string => Boolean(x && x.trim()));
    return parca.filter((x, i) => i === 0 || !(parca[0] ?? '').toLocaleLowerCase('tr-TR').includes(x.toLocaleLowerCase('tr-TR'))).join(', ') || '—';
  };
  const vergi = (daire: string | null, no: string | null) => [daire, no].filter(Boolean).join(' / ') || '—';

  const ihbar = s.noticeDays > 0 ? doldur(k.ihbarGun, { n: s.noticeDays }) : k.belirtilmemis;
  const yenileme = s.autoRenew ? doldur(k.yenilemeVar, { n: s.renewMonths }) : k.yenilemeYok;
  const zam = s.escalationMonths
    ? (s.escalationRate !== null ? doldur(k.zamVar, { n: s.escalationMonths, o: b.sayi(Number(s.escalationRate)) }) : doldur(k.zamOransiz, { n: s.escalationMonths }))
    : k.belirtilmemis;
  const slaParcalari = [
    s.slaResponseMins ? doldur(k.slaMudahale, { s: sureMetni(s.slaResponseMins) }) : null,
    s.slaResolutionMins ? doldur(k.slaCozum, { s: sureMetni(s.slaResolutionMins) }) : null,
  ].filter(Boolean);
  const sla = slaParcalari.length ? `${slaParcalari.join(', ')} (${k.slaCalisma}${s.slaPauseOnPart ? k.slaParca : ''})` : k.belirtilmemis;
  const durumAd = s.status === 'FESIH' ? k.durumFesih : s.status === 'BITTI' ? k.durumBitti : null;

  return (
    <>
      <style>{`
        @page { size: A4 portrait; margin: 18mm 16mm 20mm;
          @bottom-left { content: "${k.paraf}: ............   ............"; font: 8.5pt 'Times New Roman', serif; color: #333; }
          @bottom-right { content: "${k.sayfa} " counter(page) " / " counter(pages); font: 8.5pt 'Times New Roman', serif; color: #333; } }
        .soz-sarmal { padding: 2.5rem 1rem; background: #e5e7eb; min-height: 100vh; }
        .soz { max-width: 794px; margin: 0 auto; background: #fff; color: #000; padding: 48px 56px;
          font-family: 'Times New Roman', Times, serif; font-size: 10.5pt; line-height: 1.45; box-shadow: 0 8px 40px rgba(0,0,0,.16); }
        .soz h1 { text-align: center; font-size: 13pt; font-weight: 700; letter-spacing: .02em; margin: 0; }
        .soz .ek { text-align: center; font-size: 10pt; margin: 4px 0 18px; }
        .soz h2 { font-size: 11pt; font-weight: 700; margin: 16px 0 6px; }
        .soz table { width: 100%; border-collapse: collapse; }
        .soz .taraf td { vertical-align: top; padding: 2px 0; width: 50%; }
        .soz .bilgi td { padding: 2px 8px 2px 0; vertical-align: top; }
        .soz .bilgi td:first-child { width: 34%; }
        .soz .cihaz { font-size: 9pt; margin-top: 4px; }
        .soz .cihaz th, .soz .cihaz td { border: 1px solid #000; padding: 4px 5px; text-align: left; vertical-align: top; }
        .soz .cihaz th { font-weight: 700; background: #f2f2f2; }
        .soz .cihaz td.r, .soz .cihaz th.r { text-align: right; white-space: nowrap; }
        .soz .cihaz tr { break-inside: avoid; }
        .soz .alt { color: #222; font-size: 9pt; margin-top: 6px; }
        .soz .imza { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; margin-top: 28px; break-inside: avoid; }
        .soz .imza div { border-top: 1px solid #000; padding-top: 6px; min-height: 96px; }
        .soz .durum { border: 1px solid #000; padding: 6px 8px; margin-bottom: 12px; font-weight: 700; text-align: center; }
        @media print {
          .soz-sarmal { padding: 0; background: #fff; }
          .soz { box-shadow: none; padding: 0; max-width: 100%; }
          .soz .cihaz th { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        @media (max-width: 640px) { .soz { padding: 28px 18px; } .soz .imza { grid-template-columns: 1fr; } }
      `}</style>
      <YazdirBari baslik={k.onizleme} ayrinti={doldur(k.cihazSayisi, { n: satirlar.length })} geriHref="/sozlesmeler" geriMetin={k.sozlesmelereDon} />
      <div className="soz-sarmal">
        <div className="soz">
          {durumAd && <div className="durum">{durumAd}</div>}
          <h1>{k.baslik}</h1>
          <div className="ek">{k.ek}{s.contractNo ? ` · ${k.sozlesmeNo}: ${s.contractNo}` : ''}</div>

          <h2>{k.madde1}</h2>
          <table className="taraf"><tbody><tr>
            <td>
              <strong>{k.kirayaVeren}</strong><br />
              {s.tenant.name}<br />
              {adres(s.tenant.address, s.tenant.district, s.tenant.city)}<br />
              {k.vergi}: {vergi(s.tenant.taxOffice, s.tenant.taxNumber)}<br />
              {s.tenant.phone ? <>{k.telefon}: {s.tenant.phone}</> : null}
            </td>
            <td>
              <strong>{k.kiraci}</strong><br />
              {s.customer.legalName || s.customer.name}<br />
              {adres(s.customer.address, s.customer.district, s.customer.city)}<br />
              {k.vergi}: {vergi(s.customer.taxOffice, s.customer.taxNo)}<br />
              {s.customer.contactPerson ? <>{k.yetkili}: {s.customer.contactPerson}</> : (s.customer.phone ? <>{k.telefon}: {s.customer.phone}</> : null)}
            </td>
          </tr></tbody></table>

          <h2>{k.madde2}</h2>
          <table className="bilgi"><tbody>
            <tr><td>{k.sureBaslik}</td><td>{tarih(s.startDate)} – {tarih(s.endDate)} ({doldur(k.ay, { n: ayFarki })})</td></tr>
            <tr><td>{k.ihbar}</td><td>{ihbar}</td></tr>
            <tr><td>{k.yenileme}</td><td>{yenileme}</td></tr>
            <tr><td>{k.zam}</td><td>{zam}</td></tr>
            <tr><td>{k.sla}</td><td>{sla}</td></tr>
          </tbody></table>

          <h2>{k.madde3}</h2>
          <table className="cihaz">
            <thead><tr>
              <th>#</th><th>{k.sutunCihaz}</th><th className="r">{k.sutunKira}</th>
              <th className="r">{k.sutunDahil}</th><th className="r">{k.sutunFiyat}</th><th className="r">{k.sutunAsim}</th>
            </tr></thead>
            <tbody>
              {satirlar.map((r) => (
                <tr key={r.no}>
                  <td>{r.no}</td>
                  <td>{r.ad}<br />{k.seri}: {r.seri}{r.konum ? <><br />{r.konum}</> : null}</td>
                  <td className="r">{para(r.kira)}</td>
                  <td className="r">{ikili(sayi(r.dahilS), sayi(r.dahilR))}</td>
                  <td className="r">{ikili(para(r.fiyatS, 4), para(r.fiyatR, 4))}</td>
                  <td className="r">{ikili(para(r.asimS, 4), para(r.asimR, 4))}</td>
                </tr>
              ))}
              <tr>
                <td colSpan={2}><strong>{k.toplamKira}</strong> ({doldur(k.cihazSayisi, { n: satirlar.length })})</td>
                <td className="r"><strong>{b.para(toplamKira, 2)}</strong></td>
                <td colSpan={3}></td>
              </tr>
            </tbody>
          </table>
          <div className="alt">
            {k.sutunAciklama} {doldur(k.kdv, { o: b.sayi(Number(s.tenant.vatRate)) })}
            {sistemdenVar ? <><br />{k.yildiz}</> : null}
          </div>

          {s.notes ? (<><h2>{k.madde4}</h2><p>{s.notes}</p></>) : null}

          <div className="imza">
            <div><strong>{k.kirayaVeren}</strong><br />{s.tenant.name}<br /><br />{k.adSoyad}:<br />{k.kaseImza}:<br />{k.tarih}:</div>
            <div><strong>{k.kiraci}</strong><br />{s.customer.legalName || s.customer.name}<br /><br />{k.adSoyad}:<br />{k.kaseImza}:<br />{k.tarih}:</div>
          </div>
          <div className="alt" style={{ marginTop: 18 }}>
            {doldur(k.altNot, { no: s.contractNo || '—', tarih: tarih(new Date()) })}
          </div>
        </div>
      </div>
    </>
  );
}
