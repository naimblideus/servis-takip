import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import PrintNowButton from '@/components/PrintNowButton';
import { oturumKullanicisi } from '@/lib/api-auth';
import { raporOzeti, DURUM_ADI, ONCELIK_ADI } from '@/lib/rapor-ozeti';

const fmt = (n: number) => '₺' + n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const sayi = (n: number) => n.toLocaleString('tr-TR');

/**
 * RAPOR ÖZETİ — KÂĞIT.
 *
 * Bayinin patronuna ya da muhasebecisine uzatacağı tek sayfa. Veri ekranla
 * AYNI fonksiyondan (raporOzeti) geliyor; ayrı sorgu açsaydık aynı raporun
 * ekranda başka, kâğıtta başka rakam göstermesi kaçınılmazdı.
 *
 * Grafik YOK, bilerek: çubuk grafik siyah-beyaz yazıcıda ayırt edilemiyor ve
 * kâğıtta okunan şey zaten rakamın kendisi. Ekranda grafik, kâğıtta tablo.
 */
export default async function RaporYazdirPage() {
  const session = await auth();
  if (!session) redirect('/login');
  const user = await oturumKullanicisi(session);
  if (!user) redirect('/login');

  const [o, tenant] = await Promise.all([
    raporOzeti(user.tenantId),
    prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: { name: true, phone: true, address: true, logo: true },
    }),
  ]);

  const bugun = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
  const donem = o.aylik.length ? `${o.aylik[0].label} – ${o.aylik[o.aylik.length - 1].label}` : '';
  const aylikCiro = o.aylik.reduce((s, m) => s + m.ciro, 0);
  const aylikAdet = o.aylik.reduce((s, m) => s + m.adet, 0);

  return (
    <>
      <style>{`
        /* Font YEREL: yazdirma internetsizken de dogru fontla bassin. */
        @import url('/fonts/inter.css');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', 'Segoe UI', sans-serif; background: #e5e7eb; color: #111827; }
        @page { size: A4 portrait; margin: 8mm 10mm; }
        @media print {
          .no-print { display: none !important; }
          #app-sidebar { display: none !important; }
          body { background: white !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .print-wrapper { padding: 0 !important; background: white !important; }
          .receipt { box-shadow: none !important; border-radius: 0 !important; margin: 0 !important; max-width: 100% !important; border: none !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
        @media screen {
          .print-wrapper { padding: 2.5rem; min-height: 100vh; background: #e5e7eb; }
          .receipt { max-width: 794px; margin: 0 auto; background: white; border-radius: 16px; box-shadow: 0 8px 40px rgba(0,0,0,0.16); overflow: hidden; border: 1px solid #e5e7eb; }
        }
        .header { background: linear-gradient(135deg, #0f2253 0%, #1a3a8f 50%, #2563eb 100%); color: white; padding: 18px 24px; display: flex; justify-content: space-between; align-items: center; position: relative; overflow: hidden; }
        .header::after { content: ''; position: absolute; top: -40px; right: -40px; width: 160px; height: 160px; background: rgba(255,255,255,0.05); border-radius: 50%; }
        .header-left { display: flex; align-items: center; gap: 14px; position: relative; z-index: 1; }
        .header-logo { max-height: 52px; max-width: 140px; object-fit: contain; background: white; border-radius: 8px; padding: 4px 8px; }
        .company-name { font-size: 17px; font-weight: 800; line-height: 1.2; letter-spacing: -0.2px; }
        .company-sub { font-size: 12px; opacity: 0.75; margin-top: 3px; }
        .header-right { text-align: right; position: relative; z-index: 1; }
        .doc-label { font-size: 9px; font-weight: 700; opacity: 0.65; text-transform: uppercase; letter-spacing: 0.12em; background: rgba(255,255,255,0.15); padding: 2px 8px; border-radius: 4px; display: inline-block; margin-bottom: 4px; }
        .doc-title { font-size: 22px; font-weight: 800; line-height: 1; letter-spacing: 0.3px; }
        .doc-date { font-size: 11px; opacity: 0.75; margin-top: 5px; }
        .body { padding: 18px 24px; }
        .ozet { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; }
        .ozet-kutu { border: 1.5px solid #e5e7eb; border-radius: 10px; padding: 10px 12px; }
        .ozet-etiket { font-size: 9.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.07em; color: #6b7280; }
        .ozet-deger { font-size: 19px; font-weight: 800; margin-top: 3px; line-height: 1.1; font-variant-numeric: tabular-nums; }
        .ozet-not { font-size: 9.5px; color: #9ca3af; margin-top: 2px; }
        .section-title { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: #374151; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 2px solid #e5e7eb; }
        .ext-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 16px; border: 1.5px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
        .ext-table thead tr { background: linear-gradient(90deg, #f9fafb, #f3f4f6); }
        .ext-table th { padding: 8px 12px; text-align: left; border-bottom: 2px solid #d1d5db; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: #374151; }
        .ext-table td { padding: 7px 12px; border-bottom: 1px solid #f3f4f6; font-size: 12.5px; }
        .ext-table tr:last-child td { border-bottom: none; }
        .ext-total td { border-top: 2px solid #d1d5db !important; font-weight: 800; background: #f9fafb; font-size: 13px; }
        .num { text-align: right; font-variant-numeric: tabular-nums; }
        .ikili { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .footer { text-align: center; font-size: 10px; color: #9ca3af; padding: 10px 24px 14px; border-top: 1px solid #f3f4f6; background: #fafafa; }
        .empty { text-align: center; color: #9ca3af; padding: 24px; font-size: 13px; }
      `}</style>

      <PrintNowButton />

      <div className="print-wrapper">
        <div className="receipt">
          <div className="header">
            <div className="header-left">
              {tenant?.logo && <img src={tenant.logo} alt="Logo" className="header-logo" />}
              <div>
                <div className="company-name">{tenant?.name ?? 'Servis'}</div>
                <div className="company-sub">
                  {[tenant?.phone, tenant?.address].filter(Boolean).join(' · ')}
                </div>
              </div>
            </div>
            <div className="header-right">
              <div className="doc-label">Rapor</div>
              <div className="doc-title">Genel Durum</div>
              <div className="doc-date">{bugun}{donem ? ` · ${donem}` : ''}</div>
            </div>
          </div>

          <div className="body">
            <div className="ozet">
              <div className="ozet-kutu">
                <div className="ozet-etiket">Toplam Fiş</div>
                <div className="ozet-deger">{sayi(o.toplamlar.fis)}</div>
              </div>
              <div className="ozet-kutu">
                <div className="ozet-etiket">Müşteri</div>
                <div className="ozet-deger">{sayi(o.toplamlar.musteri)}</div>
              </div>
              <div className="ozet-kutu">
                <div className="ozet-etiket">Cihaz</div>
                <div className="ozet-deger">{sayi(o.toplamlar.cihaz)}</div>
              </div>
              <div className="ozet-kutu">
                <div className="ozet-etiket">İş Hacmi</div>
                <div className="ozet-deger">{fmt(o.toplamlar.ciro)}</div>
                {/* Bu rakam TAHSİLAT DEĞİL. Aşağıdaki aylık tablo yalnız
                    ödenmiş fişleri sayıyor; ikisini ayırmazsak bayi
                    kazanmadığı parayı kazanmış sanır. */}
                <div className="ozet-not">tahsil edilmemiş dahil</div>
              </div>
            </div>

            <div className="section-title">Son {o.ayAdedi} ay</div>
            <table className="ext-table">
              <thead>
                <tr>
                  <th>Ay</th>
                  <th className="num">Açılan fiş</th>
                  <th className="num">Tahsil edilen</th>
                </tr>
              </thead>
              <tbody>
                {o.aylik.map((m) => (
                  <tr key={m.label}>
                    <td>{m.label}</td>
                    <td className="num">{sayi(m.adet)}</td>
                    <td className="num">{fmt(m.ciro)}</td>
                  </tr>
                ))}
                <tr className="ext-total">
                  <td>Toplam</td>
                  <td className="num">{sayi(aylikAdet)}</td>
                  <td className="num">{fmt(aylikCiro)}</td>
                </tr>
              </tbody>
            </table>

            <div className="ikili">
              <div>
                <div className="section-title">Fiş durumu</div>
                <table className="ext-table">
                  <thead><tr><th>Durum</th><th className="num">Adet</th></tr></thead>
                  <tbody>
                    {o.durumlar.length === 0 && <tr><td colSpan={2} className="empty">Fiş yok</td></tr>}
                    {o.durumlar.map((d) => (
                      <tr key={d.durum}>
                        <td>{DURUM_ADI[d.durum] ?? d.durum}</td>
                        <td className="num">{sayi(d.adet)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <div className="section-title">Öncelik</div>
                <table className="ext-table">
                  <thead><tr><th>Öncelik</th><th className="num">Adet</th></tr></thead>
                  <tbody>
                    {o.oncelikler.length === 0 && <tr><td colSpan={2} className="empty">Fiş yok</td></tr>}
                    {o.oncelikler.map((p) => (
                      <tr key={p.oncelik}>
                        <td>{ONCELIK_ADI[p.oncelik] ?? p.oncelik}</td>
                        <td className="num">{sayi(p.adet)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="footer">
            {tenant?.name ?? 'Servis'} · {bugun} tarihinde alınmıştır · Nextus Servis
          </div>
        </div>
      </div>
    </>
  );
}
