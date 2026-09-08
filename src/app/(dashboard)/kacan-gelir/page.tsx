'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';

interface Item {
  id: string; brand: string; model: string; serialNo: string; location: string | null;
  customer: { id: string; name: string; phone: string; address: string | null } | null;
  counterAmount: number; billBlack: number; billColor: number; rentAmount: number; total: number;
  // Veri DOĞRU ama fatura müşteriyi şaşırtacaksa dolu gelir. Anomaliden
  // farkı bu: anomali "bu okuma yanlış olabilir" der, bu "okuma doğru ama
  // müşteri bu rakamı beklemiyor" der. İkisi ayrı iş: biri kontrol, öteki
  // telefon.
  sok: { kat: number; normalSayfa: number; buAySayfa: number } | null;
}
interface Summary { counterTotal: number; rentTotal: number; grandTotal: number; deviceCount: number; customerCount: number; }
// Faturaya girecek ama inandırıcı olmayan okumalar. Bu ekran "fatura kes"
// butonunun bulunduğu yer, yani zincirdeki SON insanlı nokta — uyarı
// başka bir sayfada dursa kimse görmeden fatura kesilir.
// Kapanmış bir ayda faturalanmadan kalmış okumalar. Her iki para yolu da
// okumaları dönem aralığıyla süzdüğü için bunlar bir daha HİÇBİR turun
// kapsamına girmiyor — sessiz ve kalıcı kayıp. Ekran bu yüzden var.
interface GecmisDonem { donem: string; okuma: number; cihaz: number; tutar: number; }
interface Supheli {
  id: string; deviceId: string; brand: string; model: string; serialNo: string;
  musteriId: string | null; musteri: string; tarih: string; kaynak: string;
  sayfa: number; tutar: number; kat: number | null; gun: number; beklenen: number | null; aciklama: string;
}

const fmt = (n: number) => '₺' + n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function KacanGelirPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [summary, setSummary] = useState<Summary>({ counterTotal: 0, rentTotal: 0, grandTotal: 0, deviceCount: 0, customerCount: 0 });
  const [period, setPeriod] = useState('');
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [supheli, setSupheli] = useState<{ toplam: number; tutar: number; okumalar: Supheli[] }>({ toplam: 0, tutar: 0, okumalar: [] });
  const [gecmis, setGecmis] = useState<{ donemler: GecmisDonem[]; toplam: number }>({ donemler: [], toplam: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/revenue-risk');
      const d = await r.json();
      setItems(Array.isArray(d.items) ? d.items : []);
      setSummary(d.summary || { counterTotal: 0, rentTotal: 0, grandTotal: 0, deviceCount: 0, customerCount: 0 });
      setPeriod(d.period || '');
      setGecmis({ donemler: Array.isArray(d.gecmisDonemler) ? d.gecmisDonemler : [], toplam: d.gecmisToplam || 0 });
    } catch { /* yoksay */ }
    try {
      const rs = await fetch('/api/sayac/supheli');
      if (rs.ok) { const ds = await rs.json(); setSupheli({ toplam: ds.toplam || 0, tutar: ds.tutar || 0, okumalar: Array.isArray(ds.okumalar) ? ds.okumalar : [] }); }
    } catch { /* yoksay — şüphe listesi gelmezse asıl ekran yine çalışsın */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Aynı cihaz hem şüpheli hem "şok" olabilir. O durumda ŞÜPHE önce gelir:
  // veri yanlışsa müşteriyi arayıp "çok basmışsınız" demek yanlış yönlendirme
  // olur — bayi önce okumayı kontrol etmeli. Bu yüzden şüpheli listedeki
  // cihazda şok rozeti basılmıyor.
  const supheliCihazlar = useMemo(
    () => new Set(supheli.okumalar.map((o) => o.deviceId)),
    [supheli.okumalar],
  );

  // Dönem verilirse O DÖNEM kesilir. Geçmiş ayı bu ayın faturasına eklemek
  // yerine kendi ayında kesmek şart: dahil paket dönem başına tanımlı, taşınan
  // sayfa hem kendi ayının paketini yer hem tutarı kaydırır.
  const runBilling = async (hedefDonem?: string) => {
    // Şüpheli okuma varsa onay metni bunu SAYIYLA söylüyor. "Uyarı bir yerde
    // duruyordu" yetmez: yanlış fatura müşteride teknik hata değil güven
    // kaybı yaratır, ve o noktadan sonra düzeltmenin bedeli bir müşteridir.
    const uyari = supheli.toplam > 0
      ? `⚠️ DİKKAT: ${supheli.toplam} okuma cihazın normal kullanımına uymuyor (${fmt(supheli.tutar)}). Faturaya bu hâliyle girecekler.

`
      : '';
    const donemMetni = hedefDonem
      ? `${hedefDonem} DÖNEMİ için (geçmiş ay) tüm müşterilere fatura kesilecek.`
      : 'Bu dönem için tüm müşterilere otomatik fatura kesilecek (sayaç aşımı + kira + ödenmemiş servis).';
    if (!confirm(uyari + donemMetni + ' Devam edilsin mi?')) return;
    setRunning(true); setMsg(null);
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(hedefDonem ? { period: hedefDonem } : {}),
      });
      const d = await res.json();
      if (res.ok) { setMsg(`✓ ${hedefDonem ? `${hedefDonem} dönemi: ` : ''}${d.created} fatura kesildi (toplam ${fmt(d.total)})${d.errors ? ` · ${d.errors} hata` : ''}`); load(); }
      else setMsg('❌ ' + (d.error || 'Hata'));
    } catch { setMsg('❌ Sunucuya bağlanılamadı'); }
    setRunning(false);
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: 880, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>💸 Kaçan Gelir — Bu Dönem</h1>
          <p style={{ color: '#6b7280', margin: '0.25rem 0 0', fontSize: '0.9rem' }}>
            {period && <b>{period}</b>} döneminde <b>kazanılmış ama henüz faturalanmamış</b> tutar: okunmuş sayaç aşımı + kesilmemiş kira. Ay kapanmadan faturala, kaçırma.
          </p>
        </div>
        {summary.grandTotal > 0 && (
          <button onClick={() => runBilling()} disabled={running}
            style={{ padding: '0.6rem 1.1rem', background: '#16a34a', color: 'white', border: 'none', borderRadius: 10, fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer', opacity: running ? 0.6 : 1, whiteSpace: 'nowrap' }}>
            {running ? 'Kesiliyor…' : '⚡ Bu Dönemi Faturala'}
          </button>
        )}
      </div>

      {msg && <div style={{ margin: '1rem 0 0', padding: '0.7rem 1rem', borderRadius: 10, background: '#f0fdf4', border: '1px solid #bbf7d0', fontSize: '0.88rem', color: '#15803d' }}>{msg}</div>}

      <div style={{ display: 'flex', gap: 10, margin: '1rem 0', flexWrap: 'wrap' }}>
        <div style={{ flex: 2, minWidth: 200, background: 'linear-gradient(135deg,#7f1d1d,#dc2626)', color: 'white', borderRadius: 12, padding: '0.9rem 1.1rem' }}>
          <div style={{ fontSize: '0.72rem', opacity: 0.85, fontWeight: 700 }}>TOPLAM RİSKTEKİ GELİR (KDV hariç, tahmini)</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{fmt(summary.grandTotal)}</div>
          <div style={{ fontSize: '0.74rem', opacity: 0.9, marginTop: 2 }}>{summary.deviceCount} cihaz · {summary.customerCount} müşteri</div>
        </div>
        <div style={{ flex: 1, minWidth: 130, background: 'white', border: '1px solid #fde68a', borderRadius: 12, padding: '0.9rem 1.1rem' }}>
          <div style={{ fontSize: '0.72rem', color: '#92400e', fontWeight: 700 }}>SAYAÇ AŞIMI</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#b45309' }}>{fmt(summary.counterTotal)}</div>
        </div>
        <div style={{ flex: 1, minWidth: 130, background: 'white', border: '1px solid #bfdbfe', borderRadius: 12, padding: '0.9rem 1.1rem' }}>
          <div style={{ fontSize: '0.72rem', color: '#1e40af', fontWeight: 700 }}>KESİLMEMİŞ KİRA</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#1d4ed8' }}>{fmt(summary.rentTotal)}</div>
        </div>
      </div>

      {gecmis.donemler.length > 0 && (
        <div style={{ margin: '0 0 1rem', borderRadius: 12, border: '1px solid #c7d2fe', background: '#eef2ff', padding: '0.85rem 1rem' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ fontWeight: 800, color: '#3730a3', fontSize: '0.95rem' }}>
              🗓️ Geçmiş aylarda faturalanmamış sayaç var
            </div>
            <div style={{ fontSize: '0.78rem', color: '#3730a3', fontWeight: 700, whiteSpace: 'nowrap' }}>{fmt(gecmis.toplam)}</div>
          </div>
          <p style={{ margin: '0.25rem 0 0.6rem', fontSize: '0.78rem', color: '#312e81', lineHeight: 1.5 }}>
            Bu okumalar kapanmış bir aya ait ve o ay faturalanmamış. Aylık faturalama yalnız <b>içinde
            bulunulan</b> döneme bakar; bu yüzden kendiliğinden bir daha kesilmezler. Her ayı <b>kendi
            dönemiyle</b> kesin — geçmiş ayın sayfalarını bu aya taşımak dahil paketi ve tutarı bozar.
          </p>
          <div style={{ display: 'grid', gap: 6 }}>
            {gecmis.donemler.map((g) => (
              <div key={g.donem} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', background: 'white', border: '1px solid #ddd6fe', borderRadius: 10, padding: '0.55rem 0.7rem' }}>
                <div style={{ fontSize: '0.86rem' }}>
                  <b>{g.donem}</b>
                  <span style={{ color: '#6b7280' }}> · {g.okuma} okuma · {g.cihaz} cihaz</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontWeight: 800, color: '#3730a3' }}>{fmt(g.tutar)}</span>
                  <button onClick={() => runBilling(g.donem)} disabled={running}
                    style={{ padding: '0.6rem 0.9rem', minHeight: 40, background: '#4338ca', color: 'white', border: 'none', borderRadius: 8, fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', opacity: running ? 0.6 : 1, whiteSpace: 'nowrap' }}>
                    {g.donem} dönemini kes
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {supheli.toplam > 0 && (
        <div style={{ margin: '0 0 1rem', borderRadius: 12, border: '1px solid #fdba74', background: '#fff7ed', padding: '0.85rem 1rem' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ fontWeight: 800, color: '#9a3412', fontSize: '0.95rem' }}>
              ⚠️ {supheli.toplam} okuma cihazın normal kullanımına uymuyor
            </div>
            <div style={{ fontSize: '0.78rem', color: '#9a3412', fontWeight: 700, whiteSpace: 'nowrap' }}>faturaya girecek: {fmt(supheli.tutar)}</div>
          </div>
          <p style={{ margin: '0.25rem 0 0.6rem', fontSize: '0.78rem', color: '#7c2d12', lineHeight: 1.5 }}>
            Bunlar &quot;yanlış&quot; demek değil, <b>kontrol edilmedi</b> demek. Faturalamadan önce bakın:
            yanlış cihazın raporu, hatalı okuma ya da değişen makine olabilir. Faturadan sonra düzeltmek
            müşteride güven kaybı yaratır.
          </p>
          <div style={{ display: 'grid', gap: 6 }}>
            {supheli.okumalar.slice(0, 8).map((o) => (
              <Link key={o.id} href={`/devices/${o.deviceId}`}
                style={{ display: 'block', background: 'white', border: '1px solid #fed7aa', borderRadius: 10, padding: '0.55rem 0.7rem', textDecoration: 'none', color: 'inherit' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: '0.86rem', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700 }}>{o.musteri} <span style={{ fontWeight: 400, color: '#6b7280' }}>· {o.brand} {o.model} · SN {o.serialNo}</span></span>
                  <span style={{ color: '#9a3412', fontWeight: 800, whiteSpace: 'nowrap' }}>{fmt(o.tutar)}</span>
                </div>
                <div style={{ fontSize: '0.74rem', color: '#7c2d12', marginTop: 2 }}>{o.aciklama}</div>
              </Link>
            ))}
            {supheli.okumalar.length > 8 && (
              <div style={{ fontSize: '0.74rem', color: '#9a3412' }}>+{supheli.okumalar.length - 8} okuma daha</div>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <p style={{ color: '#9ca3af' }}>Yükleniyor…</p>
      ) : items.length === 0 ? (
        <p style={{ color: '#16a34a', textAlign: 'center', padding: '2rem', fontWeight: 600 }}>✅ Bu dönem için riskte (faturalanmamış kazanılmış) gelir yok. Her şey faturalanmış!</p>
      ) : (
        <div style={{ display: 'grid', gap: '0.6rem' }}>
          {items.map((i) => (
            <div key={i.id} style={{ background: 'white', border: '1px solid #fecaca', borderLeft: '4px solid #dc2626', borderRadius: 12, padding: '0.9rem 1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>{i.brand} {i.model} <span style={{ fontSize: '0.78rem', color: '#6b7280', fontWeight: 400 }}>· SN {i.serialNo}</span></div>
                  <div style={{ fontSize: '0.85rem', color: '#374151', marginTop: 2 }}>
                    👤 {i.customer ? <Link href={`/customers/${i.customer.id}`} style={{ color: '#1d4ed8', textDecoration: 'none', padding: '0.35rem 0.15rem' }}>{i.customer.name}</Link> : '—'}
                    {i.location ? ` · ${i.location}` : ''}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: 4, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {i.counterAmount > 0 && <span>📄 Sayaç aşımı: <b style={{ color: '#b45309' }}>{fmt(i.counterAmount)}</b> ({(i.billBlack).toLocaleString('tr-TR')} S/B{i.billColor > 0 ? ` · ${i.billColor.toLocaleString('tr-TR')} renkli` : ''})</span>}
                    {i.rentAmount > 0 && <span>🏷️ Kira: <b style={{ color: '#1d4ed8' }}>{fmt(i.rentAmount)}</b></span>}
                  </div>
                  {i.sok && !supheliCihazlar.has(i.id) && (
                    <div style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, padding: '.3rem .55rem', fontSize: '.74rem', color: '#9a3412', lineHeight: 1.4 }}>
                      <span>📈</span>
                      <span>
                        Bu ay <b>{i.sok.kat} kat</b> basılmış ({i.sok.buAySayfa.toLocaleString('tr-TR')} sayfa,
                        normalde ~{i.sok.normalSayfa.toLocaleString('tr-TR')}). Fatura müşteriyi şaşırtabilir —
                        göndermeden önce arayın.
                      </span>
                    </div>
                  )}
                </div>
                <div style={{ flexShrink: 0, textAlign: 'right' }}>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#b91c1c' }}>{fmt(i.total)}</div>
                  <Link href={`/devices/${i.id}`}
                    style={{ display: 'inline-block', padding: '0.6rem 0.4rem 0.35rem', fontSize: '0.78rem', color: '#0ea5e9', textDecoration: 'none', fontWeight: 600 }}>Cihaz →</Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
