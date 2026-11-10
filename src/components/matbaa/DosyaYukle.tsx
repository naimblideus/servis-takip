'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { doldur } from '@/lib/i18n/sozluk';
import { musteriMetni } from '@/lib/matbaa-musteri-metin';
import { dosyaTuru, DOSYA_AZAMI } from '@/lib/baski-dosya';
import { dosyaYukle, onKontrol, type YuklemeHedefi } from '@/lib/baski-yukle';

/**
 * DOSYA EKLE — var olan bir işe (takip sayfası, iş ayrıntısı). Seçilen dosya
 * hemen yüklenir; sürükleyip bırakmak da olur (WhatsApp Web'den indirilen
 * dosya tezgahta buraya bırakılır). Metinler `dil` ile gelir: müşteri
 * sayfasında bayinin dili, panelde kullanıcının dili.
 */
interface Satir { ad: string; yuzde: number; durum: 'YUKLENIYOR' | 'TAMAM' | 'HATA'; hata?: string }

export default function DosyaYukle({ hedef, dil, azamiMb, yenile, etiket }: { hedef: YuklemeHedefi; dil: string; azamiMb: number; yenile?: boolean; etiket?: string }) {
  const router = useRouter();
  const m = musteriMetni(dil);
  const giris = useRef<HTMLInputElement>(null);
  const [satirlar, setSatirlar] = useState<Satir[]>([]);
  const [ustunde, setUstunde] = useState(false);
  const mesgul = satirlar.some((s) => s.durum === 'YUKLENIYOR');

  async function yukle(dosyalar: File[]) {
    for (const dosya of dosyalar) {
      const sira = await new Promise<number>((coz) => setSatirlar((l) => { coz(l.length); return [...l, { ad: dosya.name, yuzde: 0, durum: 'YUKLENIYOR' }]; }));
      const guncelle = (ek: Partial<Satir>) => setSatirlar((l) => l.map((s, i) => (i === sira ? { ...s, ...ek } : s)));
      // Sunucu da denetler; burada yalnız boşa yükleme başlamasın.
      if (!dosyaTuru(dosya.name)) { guncelle({ durum: 'HATA', hata: m.uyari.TUR }); continue; }
      if (dosya.size > DOSYA_AZAMI) { guncelle({ durum: 'HATA', hata: m.uyari.BUYUK }); continue; }
      const bilgi = await onKontrol(dosya);
      const r = await dosyaYukle(dosya, hedef, bilgi, (yuzde) => guncelle({ yuzde }));
      guncelle(r.ok ? { durum: 'TAMAM', yuzde: 100 } : { durum: 'HATA', hata: r.hata ?? m.yuklenemedi });
    }
    if (yenile) router.refresh();
  }

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setUstunde(true); }}
        onDragLeave={() => setUstunde(false)}
        onDrop={(e) => { e.preventDefault(); setUstunde(false); if (!mesgul) void yukle([...e.dataTransfer.files]); }}
        className={`rounded-xl border-2 border-dashed px-4 py-4 text-center ${ustunde ? 'border-[#0f2253] bg-blue-50' : 'border-slate-300'}`}
      >
        <button type="button" disabled={mesgul} onClick={() => giris.current?.click()} className="rounded-lg bg-[#0f2253] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{etiket ?? m.dosyaEkle}</button>
        <p className="mt-2 text-xs text-slate-500">{doldur(m.dosyaTurleri, { mb: azamiMb })}</p>
        <input ref={giris} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.tif,.tiff" className="hidden"
          onChange={(e) => { const l = [...(e.target.files ?? [])]; e.target.value = ''; if (l.length) void yukle(l); }} />
      </div>
      {satirlar.map((s, i) => (
        <div key={i} className="mt-2 text-sm">
          <div className="flex justify-between gap-3">
            <span className="min-w-0 truncate">{s.ad}</span>
            <span className={`shrink-0 ${s.durum === 'HATA' ? 'text-red-700' : s.durum === 'TAMAM' ? 'text-emerald-700' : 'text-slate-500'}`}>
              {s.durum === 'TAMAM' ? m.yuklendi : s.durum === 'HATA' ? (s.hata ?? m.yuklenemedi) : doldur(m.yukleniyor, { yuzde: s.yuzde })}
            </span>
          </div>
          {s.durum === 'YUKLENIYOR' && <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-[#0f2253] transition-[width]" style={{ width: `${s.yuzde}%` }} /></div>}
        </div>
      ))}
    </div>
  );
}
