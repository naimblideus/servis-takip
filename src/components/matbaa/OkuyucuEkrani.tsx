'use client';

import { useEffect, useRef, useState } from 'react';
import { useDil, useT } from '@/lib/i18n/client';
import { matbaaMetni } from '@/lib/matbaa-metin';
import { AZAMI_GORSEL, AZAMI_METIN, AZAMI_PDF, kaynakTuru, type TaslakGorunumu } from '@/lib/baski-okuyucu';
import TezgahFormu, { type TezgahUrunu } from '@/components/matbaa/TezgahFormu';

/**
 * SİPARİŞ OKUYUCU — WhatsApp'tan gelen fotoğraf, PDF ya da yazı.
 *
 * Dosya sürüklenir, seçilir ya da yapıştırılır (WhatsApp Web'de görsele sağ
 * tık → kopyala → Ctrl+V). Fotoğraf göndermeden önce tarayıcıda küçültülür:
 * en uzun kenar 2000 px. Hem mobil veri azalır hem modelin 5 MB sınırı aşılmaz.
 *
 * Okununca taslak aynı ekranda tezgah formu olarak açılır; solda gönderilen
 * durur (yalnız bu sekmenin belleğinde — sunucuda saklanmaz).
 */
const AZAMI_KENAR = 2000;
const KUCULTME_ESIGI = 1_500_000;

async function kucult(f: File): Promise<File> {
  const url = URL.createObjectURL(f);
  try {
    const img = await new Promise<HTMLImageElement>((ok, no) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = no;
      i.src = url;
    });
    const olcek = Math.min(1, AZAMI_KENAR / Math.max(img.naturalWidth, img.naturalHeight));
    if (olcek === 1 && f.size <= KUCULTME_ESIGI) return f;
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * olcek));
    c.height = Math.max(1, Math.round(img.naturalHeight * olcek));
    const ctx = c.getContext('2d');
    if (!ctx) return f;
    ctx.fillStyle = '#fff'; // şeffaf PNG siyaha dönmesin
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, 'image/jpeg', 0.85));
    return blob ? new File([blob], `${f.name.replace(/\.[^.]+$/, '') || 'siparis'}.jpg`, { type: 'image/jpeg' }) : f;
  } catch {
    return f;
  } finally {
    URL.revokeObjectURL(url);
  }
}

type Sonuc = { id: string; taslak: TaslakGorunumu };

export default function OkuyucuEkrani({ urunler, fiyatsizVar, yonetici }: { urunler: TezgahUrunu[]; fiyatsizVar: boolean; yonetici: boolean }) {
  const { dil } = useDil();
  const t = useT();
  const m = matbaaMetni(dil);
  const o = m.okuyucu;
  const hataMetni = (kod: string) => (t.ucHata as Record<string, string>)[`BASKI_${kod}`] ?? m.hataGenel;

  const [dosya, setDosya] = useState<File | null>(null);
  const [onizleme, setOnizleme] = useState<string | null>(null);
  const [metin, setMetin] = useState('');
  const [durum, setDurum] = useState<'bos' | 'hazirlaniyor' | 'okunuyor'>('bos');
  const [hata, setHata] = useState('');
  const [sonuc, setSonuc] = useState<Sonuc | null>(null);
  const [surukle, setSurukle] = useState(false);
  const girdi = useRef<HTMLInputElement>(null);

  // Önizleme adresi bellekte; değişince ya da ekran kapanınca bırakılır.
  useEffect(() => () => { if (onizleme) URL.revokeObjectURL(onizleme); }, [onizleme]);

  async function dosyaAl(f: File | null | undefined) {
    if (!f) return;
    setHata('');
    const kaynak = kaynakTuru(f.type);
    if (!kaynak) { setHata(hataMetni('OKUMA_TUR')); return; }
    setDurum('hazirlaniyor');
    const hazir = kaynak === 'FOTO' ? await kucult(f) : f;
    setDurum('bos');
    if (hazir.size > (kaynak === 'FOTO' ? AZAMI_GORSEL : AZAMI_PDF)) { setHata(hataMetni('OKUMA_BUYUK')); return; }
    setDosya(hazir);
    setOnizleme(URL.createObjectURL(hazir));
  }

  function temizle() {
    setDosya(null);
    setOnizleme(null);
    setMetin('');
    setSonuc(null);
    setHata('');
    if (girdi.current) girdi.current.value = '';
  }

  // Ctrl+V: panodaki görsel (WhatsApp Web'den kopyalanan) dosya olarak alınır.
  useEffect(() => {
    if (sonuc) return;
    const yapistir = (e: ClipboardEvent) => {
      const f = [...(e.clipboardData?.files ?? [])][0];
      if (f) { e.preventDefault(); void dosyaAl(f); }
    };
    window.addEventListener('paste', yapistir);
    return () => window.removeEventListener('paste', yapistir);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sonuc]);

  async function oku() {
    if (!dosya && !metin.trim()) { setHata(hataMetni('OKUMA_BOS')); return; }
    setHata('');
    setDurum('okunuyor');
    const fd = new FormData();
    if (dosya) fd.append('dosya', dosya);
    if (metin.trim()) fd.append('metin', metin.trim());
    const r = await fetch('/api/matbaa/okuma', { method: 'POST', body: fd }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setDurum('bos');
    if (!r?.ok || !j.id) { setHata(j.error ?? hataMetni('OKUMA_MODEL_HATASI')); return; }
    setSonuc({ id: j.id, taslak: j.taslak });
    // Sayfa yenilenirse taslak kaybolmasın: adres taslağın kendi sayfası olur.
    window.history.replaceState(null, '', `/matbaa/isler/oku/${j.id}`);
  }

  if (sonuc) {
    return (
      <div className="lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-4">
        <aside className="mt-4 rounded-2xl border border-gray-200 bg-white p-3 lg:sticky lg:top-4 lg:self-start">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-gray-700">{o.gonderilen}</h2>
            <button type="button" onClick={() => { temizle(); window.history.replaceState(null, '', '/matbaa/isler/oku'); }}
              className="text-sm font-semibold text-[#0f2253]">{o.yeniOku}</button>
          </div>
          {dosya && onizleme && dosya.type.startsWith('image/') && (
            <a href={onizleme} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element -- yerel önizleme (blob:), optimizasyon gereksiz */}
              <img src={onizleme} alt={o.gonderilen} className="mt-2 max-h-[60vh] w-full rounded-lg object-contain" />
            </a>
          )}
          {dosya && onizleme && dosya.type === 'application/pdf' && (
            <a href={onizleme} target="_blank" rel="noreferrer" className="mt-2 block truncate text-sm font-semibold text-[#0f2253] underline">{dosya.name}</a>
          )}
          {metin.trim() && <pre className="mt-2 max-h-[40vh] overflow-auto whitespace-pre-wrap rounded-lg bg-gray-50 p-2 text-sm text-gray-800">{metin}</pre>}
          <p className="mt-2 text-xs text-gray-500">{o.dosyaSaklanmaz}</p>
        </aside>
        <TezgahFormu urunler={urunler} fiyatsizVar={fiyatsizVar} yonetici={yonetici} taslak={{ okumaId: sonuc.id, ...sonuc.taslak }} />
      </div>
    );
  }

  const mesgul = durum !== 'bos';
  return (
    <div className="mt-4 space-y-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setSurukle(true); }}
        onDragLeave={() => setSurukle(false)}
        onDrop={(e) => { e.preventDefault(); setSurukle(false); void dosyaAl(e.dataTransfer.files?.[0]); }}
        className={`rounded-2xl border-2 border-dashed p-4 text-center ${surukle ? 'border-[#0f2253] bg-blue-50' : 'border-gray-300 bg-white'}`}
      >
        {dosya && onizleme ? (
          <div className="flex items-center gap-3 text-left">
            {dosya.type.startsWith('image/')
              // eslint-disable-next-line @next/next/no-img-element -- yerel önizleme (blob:)
              ? <img src={onizleme} alt="" className="h-20 w-20 rounded-lg object-cover" />
              : <span className="flex h-20 w-20 items-center justify-center rounded-lg bg-gray-100 text-sm font-bold text-gray-600">PDF</span>}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-gray-800">{dosya.name}</p>
              <p className="text-xs text-gray-500">{(dosya.size / 1024 / 1024).toFixed(1)} MB</p>
            </div>
            <button type="button" onClick={() => { setDosya(null); setOnizleme(null); if (girdi.current) girdi.current.value = ''; }}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700">{o.dosyaKaldir}</button>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-600">{o.birak}</p>
            <button type="button" onClick={() => girdi.current?.click()} disabled={mesgul}
              className="mt-3 rounded-xl border border-[#0f2253] px-4 py-2 text-sm font-bold text-[#0f2253] disabled:opacity-50">{o.dosyaSec}</button>
          </>
        )}
        <input ref={girdi} type="file" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf" className="hidden"
          onChange={(e) => void dosyaAl(e.target.files?.[0])} />
      </div>

      <div>
        <label htmlFor="okuma-metin" className="mb-1 block text-xs font-semibold text-gray-600">{o.metinEtiket}</label>
        <textarea id="okuma-metin" value={metin} onChange={(e) => setMetin(e.target.value)} rows={4} maxLength={AZAMI_METIN}
          placeholder={o.metinYer} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-[15px] focus:border-[#0f2253] focus:outline-none" />
      </div>

      {hata && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{hata}</div>}

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={oku} disabled={mesgul || (!dosya && !metin.trim())}
          className="rounded-xl bg-[#0f2253] px-6 py-3 text-base font-bold text-white disabled:opacity-50">
          {durum === 'okunuyor' ? o.okunuyor : durum === 'hazirlaniyor' ? o.hazirlaniyor : o.oku}
        </button>
        <p className="text-xs text-gray-500">{o.dosyaSaklanmaz}</p>
      </div>
    </div>
  );
}
