'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useT } from '@/lib/i18n/client';
import { doldur } from '@/lib/i18n/sozluk';
import { rehberOku, musteriAdi, TOPLU_AZAMI, type RehberKisisi } from '@/lib/rehber-oku';
import { normalizePhone } from '@/lib/sheet-import';
import { metniCoz } from '@/lib/tablo-metin';

type Satir = { id: number; ad: string; yetkili: string | null; telefon: string; secili: boolean };
type Sonuc = { eklenen: number; telefonuTamamlanan: number; zatenVar: number; gecersiz: number };

/**
 * TELEFON REHBERİNDEN MÜŞTERİ — kaydı olmayan bayinin listesi rehberindedir.
 *
 * Android'de rehberden çoklu seçim (Contact Picker), iPhone ve bilgisayarda
 * rehber dosyası (.vcf). Dosya tarayıcıda okunur, sunucuya gitmez; yalnız
 * bayinin işaretlediği kişiler gider. Rehberde akraba ve arkadaş da olduğu
 * için dosyadan gelen kişiler İŞARETSİZ başlar; telefondan seçilenler zaten
 * seçilmiş sayılır.
 */
export default function RehberdenEkle() {
  const t = useT();
  const k = t.rehberEkle;
  const [satirlar, setSatirlar] = useState<Satir[] | null>(null);
  const [kayitli, setKayitli] = useState<Set<string>>(new Set());
  const [ara, setAra] = useState('');
  const [hata, setHata] = useState<string | null>(null);
  const [mesgul, setMesgul] = useState(false);
  const [sonuc, setSonuc] = useState<Sonuc | null>(null);
  const [secici, setSecici] = useState(false);
  const dosyaRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSecici('contacts' in navigator && 'ContactsManager' in window);
    // Kayıtlı numaralar "zaten var" diye gösterilir (sunucu da ayrıca atlar).
    fetch('/api/customers')
      .then((r) => (r.ok ? r.json() : []))
      .then((l: unknown) => setKayitli(new Set((Array.isArray(l) ? l : []).map((c: any) => normalizePhone(c?.phone)).filter(Boolean))))
      .catch(() => {});
  }, []);

  const kur = (kisiler: RehberKisisi[], secili: boolean) => {
    const out = kisiler.map((kisi, i) => {
      const m = musteriAdi(kisi);
      return { id: i, ad: m.ad, yetkili: m.yetkili, telefon: kisi.telefonlar[0], secili };
    });
    out.sort((a, b) => a.ad.localeCompare(b.ad, 'tr'));
    setSatirlar(out); setSonuc(null); setHata(null); setAra('');
  };

  const rehberdenSec = async () => {
    try {
      const secilen = await (navigator as any).contacts.select(['name', 'tel'], { multiple: true });
      const kisiler: RehberKisisi[] = (secilen ?? [])
        .map((c: any) => ({ ad: String(c?.name?.[0] ?? '').trim(), firma: '', telefonlar: (c?.tel ?? []).filter((x: string) => /\d/.test(x)) }))
        .filter((x: RehberKisisi) => x.ad && x.telefonlar.length);
      if (kisiler.length) kur(kisiler, true);
    } catch { /* bayi vazgeçti */ }
  };

  const dosyaSec = async (f: File | null) => {
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) { setHata(k.dosyaBuyuk); return; }
    const kisiler = rehberOku(metniCoz(new Uint8Array(await f.arrayBuffer())));
    if (!kisiler.length) { setHata(k.bosDosya); setSatirlar(null); return; }
    kur(kisiler, false);
  };

  const varMi = (s: Satir) => kayitli.has(normalizePhone(s.telefon));
  const gorunen = useMemo(() => {
    const q = ara.trim().toLocaleLowerCase('tr');
    return (satirlar ?? []).filter((s) => !q || s.ad.toLocaleLowerCase('tr').includes(q) || (s.yetkili ?? '').toLocaleLowerCase('tr').includes(q) || s.telefon.includes(q));
  }, [satirlar, ara]);
  const secilenler = (satirlar ?? []).filter((s) => s.secili && !varMi(s));

  const isaretle = (ids: Set<number>, deger: boolean) =>
    setSatirlar((l) => (l ? l.map((s) => (ids.has(s.id) ? { ...s, secili: deger } : s)) : l));

  const ekle = async () => {
    if (!secilenler.length || mesgul) return;
    if (secilenler.length > TOPLU_AZAMI) { setHata(doldur(k.cokFazla, { n: TOPLU_AZAMI })); return; }
    setMesgul(true); setHata(null);
    try {
      const r = await fetch('/api/customers/toplu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kisiler: secilenler.map((s) => ({ ad: s.ad, telefon: s.telefon, yetkili: s.yetkili })) }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setHata(d.error || t.genel.baglantiHatasi); return; }
      setSonuc(d);
      setKayitli((onceki) => new Set([...onceki, ...secilenler.map((s) => normalizePhone(s.telefon))]));
    } catch {
      setHata(t.genel.baglantiHatasi);
    } finally {
      setMesgul(false);
    }
  };

  const dugme = 'inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold';
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">{k.aciklama}</p>
      <div className="flex flex-wrap gap-2">
        {secici && (
          <button type="button" onClick={rehberdenSec} className={`${dugme} bg-emerald-600 text-white hover:bg-emerald-500`}>
            {k.rehberdenSec}
          </button>
        )}
        <button type="button" onClick={() => dosyaRef.current?.click()} className={`${dugme} border border-gray-300 bg-white text-gray-800 hover:bg-gray-50`}>
          {k.dosyaYukle}
        </button>
        <input ref={dosyaRef} type="file" accept=".vcf,text/vcard,text/x-vcard" className="hidden"
          onChange={(e) => { dosyaSec(e.target.files?.[0] ?? null); e.target.value = ''; }} />
      </div>
      <details className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
        <summary className="cursor-pointer font-semibold">{k.nasil}</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>{k.nasilIphone}</li>
          <li>{k.nasilAndroid}</li>
          <li>{k.nasilGoogle}</li>
        </ul>
      </details>

      {hata && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{hata}</div>}
      {sonuc && (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          <p className="font-semibold">{doldur(k.sonuc, { e: sonuc.eklenen, v: sonuc.zatenVar })}</p>
          {sonuc.telefonuTamamlanan > 0 && <p className="mt-1">{doldur(k.tamamlanan, { t: sonuc.telefonuTamamlanan })}</p>}
          {sonuc.gecersiz > 0 && <p className="mt-1">{doldur(k.gecersiz, { g: sonuc.gecersiz })}</p>}
          <Link href="/customers" className="mt-2 inline-flex min-h-11 items-center font-semibold text-emerald-800 underline">{k.musterilereGit}</Link>
        </div>
      )}

      {satirlar && (
        <section className="rounded-2xl border border-gray-200 bg-white">
          <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 p-3">
            <input value={ara} onChange={(e) => setAra(e.target.value)} placeholder={k.ara}
              className="min-h-11 min-w-0 flex-1 rounded-lg border border-gray-300 px-3 text-sm" />
            <button type="button" onClick={() => isaretle(new Set(gorunen.filter((s) => !varMi(s)).map((s) => s.id)), true)} className="min-h-11 rounded-lg px-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-50">{k.tumunuSec}</button>
            <button type="button" onClick={() => isaretle(new Set(gorunen.map((s) => s.id)), false)} className="min-h-11 rounded-lg px-3 text-sm font-semibold text-gray-600 hover:bg-gray-50">{k.hicbiri}</button>
          </div>
          <p className="px-3 pt-2 text-xs text-gray-500">{doldur(k.sayim, { n: satirlar.length, s: secilenler.length })}</p>
          <ul className="max-h-[60vh] divide-y divide-gray-100 overflow-y-auto">
            {gorunen.map((s) => {
              const v = varMi(s);
              return (
                <li key={s.id}>
                  <label className={`flex min-h-12 items-center gap-3 px-3 py-2 ${v ? 'opacity-60' : 'cursor-pointer hover:bg-gray-50'}`}>
                    <input type="checkbox" className="h-5 w-5 shrink-0" checked={s.secili && !v} disabled={v}
                      onChange={(e) => isaretle(new Set([s.id]), e.target.checked)} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-gray-900">{s.ad}</span>
                      {s.yetkili && <span className="block truncate text-xs text-gray-500">{doldur(k.yetkili, { ad: s.yetkili })}</span>}
                    </span>
                    <span className="shrink-0 text-right text-xs text-gray-600">
                      {s.telefon}
                      {v && <span className="block font-semibold text-amber-700">{k.kayitli}</span>}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          <div className="sticky bottom-0 border-t border-gray-100 bg-white p-3">
            <button type="button" onClick={ekle} disabled={!secilenler.length || mesgul}
              className={`${dugme} w-full bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50`}>
              {mesgul ? k.ekleniyor : doldur(k.ekle, { n: secilenler.length })}
            </button>
          </div>
        </section>
      )}
      <p className="text-xs text-gray-500">{k.gizlilik}</p>
    </div>
  );
}
