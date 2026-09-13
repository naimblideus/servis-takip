'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

/**
 * SÖZLEŞME KÂRLILIĞI — yenileme görüşmesine bu ekranla oturulur.
 *
 * Ekranın tek işi şu cümleyi kurmak: "Bu sözleşme %8 marjla çalışıyor,
 * %25 için kira ₺1.500 değil ₺2.180 olmalı." Yüzde tek başına bir şey
 * söylemiyor; rakam söylüyor.
 *
 * ÖLÇÜM KALİTESİ GİZLENMİYOR. Hiç servis fişi olmayan bir sözleşme %100
 * marj gösterir ve bu kârlılık değil kayıt eksikliğidir — satırda yazıyor.
 */

type Oneri = {
  hedefMarj: number; gerekenAylikGelir: number; eksikAylik: number;
  onerilenKira: number | null; mevcutKira: number | null;
  artisYuzde: number | null; zatenYeterli: boolean;
};
type Satir = {
  contractId: string; contractNo: string | null; musteri: string; customerId: string;
  durum: string; bitis: string; cihazSayisi: number; kapsananAy: number;
  gelir: number; parcaMaliyeti: number; iscilikMaliyeti: number; toplamMaliyet: number;
  aylikGelir: number; aylikMaliyet: number; aylikKar: number; marj: number | null;
  fisSayisi: number; sozlesmeKira: number | null;
  sayfaMaliyetiSb: number | null; sayfaFiyatiSb: number | null; sayfaZarariVar: boolean;
  oneri: Oneri | null; uyarilar: string[];
};

const UYARI: Record<string, string> = {
  FATURA_YOK: 'Bu dönemde hiç fatura kesilmemiş — marj hesaplanamıyor.',
  SERVIS_KAYDI_YOK: 'Hiç servis fişi yok; marj yüksek görünüyor ama kayıt eksikliği olabilir.',
  MALIYET_YOK: 'Hiç maliyet kaydı yok — %100 marj kârlılık değil, kayıt eksikliğidir.',
  ISCILIK_HARIC: 'İşçilik hariç.',
  PENCERE_KISA: 'Dönemin tamamı faturalanmamış; aylık rakamlar faturalanan aya bölündü.',
  ALIS_FIYATI_EKSIK: 'Bazı parçalarda alış fiyatı yok — maliyet olduğundan düşük.',
};

const tl = (n: number) =>
  `₺${n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const kurus = (n: number) =>
  `₺${n.toLocaleString('tr-TR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`;
const yuzde = (n: number) => `%${(n * 100).toFixed(1).replace('.', ',')}`;

export default function KarlilikPage() {
  const [veri, setVeri] = useState<any>(null);
  const [ay, setAy] = useState(12);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [ziyaret, setZiyaret] = useState('');
  const [hedef, setHedef] = useState('');
  const [kaydediliyor, setKaydediliyor] = useState(false);

  const yukle = async (aySayisi = ay) => {
    setYukleniyor(true);
    const r = await fetch(`/api/sozlesmeler/karlilik?ay=${aySayisi}`);
    const d = await r.json();
    setVeri(d);
    if (d.ziyaretMaliyeti != null) setZiyaret(String(d.ziyaretMaliyeti));
    if (d.hedefMarj != null) setHedef(String(Math.round(d.hedefMarj * 100)));
    setYukleniyor(false);
  };
  useEffect(() => { yukle(); }, []);

  const ayarKaydet = async () => {
    setKaydediliyor(true);
    const r = await fetch('/api/sozlesmeler/karlilik', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ziyaretMaliyeti: ziyaret, hedefMarj: hedef }),
    });
    const d = await r.json();
    if (!r.ok) alert(d.error || 'Kaydedilemedi');
    else await yukle();
    setKaydediliyor(false);
  };

  if (yukleniyor && !veri) return <div style={{ padding: '2rem', color: '#6b7280' }}>Yükleniyor…</div>;

  const satirlar: Satir[] = veri?.sozlesmeler ?? [];
  // En düşük marj başta: bayinin ilk bakacağı yer orası. Marjı ölçülemeyen
  // sözleşmeler en sonda — haklarında söylenecek bir şey yok.
  const sirali = [...satirlar].sort((a, b) => {
    if (a.marj === null && b.marj === null) return 0;
    if (a.marj === null) return 1;
    if (b.marj === null) return -1;
    return a.marj - b.marj;
  });
  const zararda = sirali.filter((s) => s.marj !== null && s.marj < 0).length;
  const hedefAlti = sirali.filter((s) => s.marj !== null && s.marj < (veri?.hedefMarj ?? 0.25)).length;
  const sayfaZarari = sirali.filter((s) => s.sayfaZarariVar).length;

  return (
    <div style={{ padding: '2rem', maxWidth: 1150 }}>
      <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>Sözleşme Kârlılığı</h1>
      <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
        Her sözleşme ne kazandırıyor, ve hedef marj için fiyat ne olmalı. Yenileme
        görüşmesine bu rakamla otur.
      </p>

      {/* AYARLAR — hesabın iki girdisi burada, gizli değil. */}
      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '0.75rem', padding: '1rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem' }}>
              Ziyaret başı maliyet
            </label>
            <input value={ziyaret} onChange={(e) => setZiyaret(e.target.value)} inputMode="decimal"
              placeholder="boş = işçilik hariç"
              style={{ width: '11rem', padding: '0.45rem 0.6rem', border: '1px solid #d1d5db', borderRadius: '0.4rem', fontSize: '0.85rem' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem' }}>
              Hedef marj (%)
            </label>
            <input value={hedef} onChange={(e) => setHedef(e.target.value)} inputMode="numeric"
              placeholder="25"
              style={{ width: '7rem', padding: '0.45rem 0.6rem', border: '1px solid #d1d5db', borderRadius: '0.4rem', fontSize: '0.85rem' }} />
          </div>
          <button onClick={ayarKaydet} disabled={kaydediliyor}
            style={{ padding: '0.5rem 1rem', borderRadius: '0.4rem', border: 'none', background: '#0f2253', color: 'white', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>
            {kaydediliyor ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
          <div style={{ display: 'flex', gap: '0.4rem', marginLeft: 'auto' }}>
            {[6, 12, 24].map((a) => (
              <button key={a} onClick={() => { setAy(a); yukle(a); }}
                style={{
                  padding: '0.4rem 0.8rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                  border: '1px solid ' + (ay === a ? '#0f2253' : '#d1d5db'),
                  background: ay === a ? '#0f2253' : 'white', color: ay === a ? 'white' : '#374151',
                }}>{a} ay</button>
            ))}
          </div>
        </div>
        {veri?.ziyaretMaliyeti == null && (
          <p style={{ fontSize: '0.76rem', color: '#b45309', margin: '0.6rem 0 0' }}>
            Ziyaret maliyeti girilmediği için <b>işçilik hesaba katılmıyor</b> — gerçek marj
            aşağıdakinden düşük. Bir saat ücreti uydurmuyoruz; kendi maliyetinizi yazın.
          </p>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(10rem, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          ['Sözleşme', satirlar.length, '#374151'],
          ['Zararda', zararda, zararda ? '#b91c1c' : '#9ca3af'],
          [`Hedefin altında (${yuzde(veri?.hedefMarj ?? 0.25)})`, hedefAlti, hedefAlti ? '#b45309' : '#15803d'],
          ['Sayfa maliyeti fiyatı aşıyor', sayfaZarari, sayfaZarari ? '#b91c1c' : '#9ca3af'],
        ].map(([l, v, c]: any) => (
          <div key={l} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '0.75rem', padding: '0.9rem' }}>
            <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>{l}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: c }}>{v}</div>
          </div>
        ))}
      </div>

      {sirali.length === 0 ? (
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '0.75rem', padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
          Cihaz bağlı sözleşme yok. <Link href="/sozlesmeler" style={{ color: '#2563eb' }}>Sözleşmeler →</Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {sirali.map((s) => {
            const kotu = s.marj !== null && s.marj < 0;
            const uyari = s.marj !== null && s.marj < (veri?.hedefMarj ?? 0.25);
            return (
              <div key={s.contractId} style={{
                background: 'white', borderRadius: '0.75rem', padding: '1rem',
                border: '1px solid ' + (kotu ? '#fecaca' : uyari ? '#fde68a' : '#e5e7eb'),
                borderLeft: '4px solid ' + (s.marj === null ? '#d1d5db' : kotu ? '#dc2626' : uyari ? '#f59e0b' : '#16a34a'),
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '1rem' }}>
                      <Link href={`/customers/${s.customerId}`} style={{ color: '#111827', textDecoration: 'none' }}>{s.musteri}</Link>
                      {s.contractNo && <span style={{ fontSize: '0.78rem', color: '#6b7280', fontWeight: 400 }}> · {s.contractNo}</span>}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: 2 }}>
                      {s.cihazSayisi} cihaz · {s.fisSayisi} servis fişi · {s.kapsananAy} ay ölçüldü
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: s.marj === null ? '#9ca3af' : kotu ? '#b91c1c' : uyari ? '#b45309' : '#15803d' }}>
                      {s.marj === null ? 'ölçülemez' : yuzde(s.marj)}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>marj</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginTop: '0.7rem', fontSize: '0.84rem' }}>
                  <span><b>{tl(s.aylikGelir)}</b> <span style={{ color: '#6b7280' }}>aylık gelir</span></span>
                  <span><b>{tl(s.aylikMaliyet)}</b> <span style={{ color: '#6b7280' }}>aylık maliyet</span></span>
                  <span style={{ color: s.aylikKar < 0 ? '#b91c1c' : '#15803d' }}><b>{tl(s.aylikKar)}</b> <span style={{ color: '#6b7280' }}>aylık kâr</span></span>
                  {s.sayfaMaliyetiSb !== null && (
                    <span style={{ color: s.sayfaZarariVar ? '#b91c1c' : '#374151' }}>
                      <b>{kurus(s.sayfaMaliyetiSb)}</b> <span style={{ color: '#6b7280' }}>sayfa toner maliyeti</span>
                      {s.sayfaFiyatiSb !== null && <> · alınan <b>{kurus(s.sayfaFiyatiSb)}</b></>}
                    </span>
                  )}
                </div>

                {/* SAYFA ZARARI — sessiz kayıp. Her basılan sayfada para
                    kaybediliyor ve bunu kimse fark etmiyor. */}
                {s.sayfaZarariVar && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: '0.5rem', padding: '0.55rem 0.8rem', marginTop: '0.6rem', fontSize: '0.82rem' }}>
                    Her sayfada zarar: toner maliyeti müşteriden alınan sayfa fiyatının üstünde.
                    Hacim arttıkça zarar da artıyor.
                  </div>
                )}

                {/* FİYAT ÖNERİSİ — görüşmede söylenecek cümlenin kendisi. */}
                {s.oneri && !s.oneri.zatenYeterli && s.oneri.onerilenKira !== null && (
                  <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '0.5rem', padding: '0.6rem 0.85rem', marginTop: '0.6rem', fontSize: '0.85rem', color: '#1e3a8a' }}>
                    <b>{yuzde(s.oneri.hedefMarj)} marj için:</b> aylık kira{' '}
                    <b>{tl(s.oneri.mevcutKira ?? 0)} → {tl(s.oneri.onerilenKira)}</b>
                    {s.oneri.artisYuzde !== null && <> ({yuzde(s.oneri.artisYuzde)} zam)</>}
                  </div>
                )}
                {s.oneri && !s.oneri.zatenYeterli && s.oneri.onerilenKira === null && (
                  <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '0.5rem', padding: '0.6rem 0.85rem', marginTop: '0.6rem', fontSize: '0.85rem', color: '#1e3a8a' }}>
                    <b>{yuzde(s.oneri.hedefMarj)} marj için</b> aylık gelir {tl(s.oneri.gerekenAylikGelir)} olmalı
                    ({tl(s.oneri.eksikAylik)} eksik). Sözleşmede kira yazılı değil, o yüzden kira önerisi çıkmıyor.
                  </div>
                )}
                {s.oneri?.zatenYeterli && (
                  <div style={{ fontSize: '0.82rem', color: '#15803d', marginTop: '0.5rem' }}>
                    Hedef marjın üstünde — zam gerekmiyor.
                  </div>
                )}

                {s.uyarilar.length > 0 && (
                  <div style={{ marginTop: '0.55rem', fontSize: '0.76rem', color: '#92400e' }}>
                    {s.uyarilar.map((u) => UYARI[u] || u).join(' ')}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p style={{ marginTop: '1.25rem', fontSize: '0.78rem', color: '#6b7280', lineHeight: 1.7 }}>
        Gelir, kesilmiş faturaların kira ve sayaç satırlarından; maliyet, fişlerde
        kullanılan parçaların <b>alış</b> fiyatından geliyor — ikisi de kayıt, tahmin değil.
        Sayfa başı toner maliyeti, sahada ölçülen verimden hesaplanıyor
        (<Link href="/toner-verimi" style={{ color: '#2563eb' }}>toner verimi</Link>);
        ölçüm yoksa o satır boş kalıyor.
      </p>
    </div>
  );
}
