'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useBarcodeWedge } from '@/hooks/useBarcodeWedge';
import CameraScanner from '@/components/CameraScanner';
import { useT } from '@/lib/i18n/client';
import { doldur } from '@/lib/i18n/sozluk';

interface Part {
  id: string;
  sku: string;
  name: string;
  barcode?: string | null;
  stockQty: number;
}

interface LogEntry {
  ok: boolean;
  text: string;
  detail?: string;
  /**
   * Stok değişimi. Oturum sayaçları eskiden EKRAN METNİNİ ayrıştırıyordu
   * (`text.includes('Giriş')`); etiket değiştiği gün sayaç sessizce sıfırda
   * kalırdı. Sayı artık veriden geliyor.
   */
  delta: number;
}

/**
 * HIZLI STOK GİRİŞ / ÇIKIŞ.
 *
 * Ayrı bir modül değil, stok işinin HIZLI HÂLİ — o yüzden menüde kendi
 * başına durmuyor, Stok ekranından ve telefondaki alt bardan açılıyor.
 * Sebebi basit: bayi form açıp adet yazmaz, okutur. Doğru stok ancak
 * okutmakla tutuluyor; form doldurmakla tutulmuyor.
 */
export default function StockScanPage() {
  const t = useT();
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'in' | 'out'>('in'); // in=giriş(+), out=çıkış(−)
  const [qty, setQty] = useState(1);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [manual, setManual] = useState('');
  const [busy, setBusy] = useState(false);

  // En güncel state'e closure-safe erişim
  const partsRef = useRef<Part[]>([]);
  const modeRef = useRef(mode);
  const qtyRef = useRef(qty);
  partsRef.current = parts;
  modeRef.current = mode;
  qtyRef.current = qty;

  const load = () => {
    fetch('/api/inventory').then((r) => r.json()).then((d: Part[]) => {
      setParts(Array.isArray(d) ? d : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const prependLog = (e: LogEntry) => setLog((l) => [e, ...l].slice(0, 50));

  const handleCode = async (raw: string) => {
    const code = raw.trim();
    if (!code || busy) return;
    const found = partsRef.current.find((p) => (p.barcode || '') === code || p.sku === code);
    if (!found) {
      prependLog({ ok: false, text: doldur(t.okutma.bulunamadi, { kod: code }), detail: t.okutma.bulunamadiAlt, delta: 0 });
      return;
    }
    const m = modeRef.current;
    const n = qtyRef.current;
    const delta = m === 'in' ? n : -n;
    if (m === 'out' && found.stockQty - n < 0) {
      prependLog({ ok: false, text: found.name, detail: doldur(t.okutma.stokYetersiz, { mevcut: found.stockQty, cikis: n }), delta: 0 });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/inventory/${found.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adjustQty: delta }),
      });
      if (res.ok) {
        const updated = await res.json();
        const newQty = typeof updated?.stockQty === 'number' ? updated.stockQty : found.stockQty + delta;
        setParts((ps) => ps.map((p) => (p.id === found.id ? { ...p, stockQty: newQty } : p)));
        prependLog({
          ok: true,
          text: found.name,
          detail: `${found.stockQty} → ${newQty}`,
          delta,
        });
      } else {
        const d = await res.json().catch(() => ({}));
        prependLog({ ok: false, text: found.name, detail: d.error || t.okutma.guncellenemedi, delta: 0 });
      }
    } catch {
      prependLog({ ok: false, text: found.name, detail: t.genel.baglantiHatasi, delta: 0 });
    }
    setBusy(false);
  };

  useBarcodeWedge((code) => handleCode(code), { enabled: !loading });

  const girisSayisi = log.filter((l) => l.ok && l.delta > 0).length;
  const cikisSayisi = log.filter((l) => l.ok && l.delta < 0).length;

  const giris = mode === 'in';

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.okutma.baslik}</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            {t.okutma.altOn} <b>{t.okutma.altVurgu}</b> {t.okutma.altOrta}{' '}
            {giris ? t.okutma.altArtar : t.okutma.altAzalir}
          </p>
        </div>
        <Link href="/inventory" className="rounded border px-3 py-2 text-sm hover:bg-gray-50">
          {t.okutma.stokListesi}
        </Link>
      </div>

      {/* ── MOD VE ADET ─────────────────────────────────────────────── */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border bg-white p-1">
          <button type="button" onClick={() => setMode('in')}
            className={`rounded-md px-4 py-2 text-sm font-semibold ${giris ? 'bg-emerald-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
            {t.okutma.girisMod}
          </button>
          <button type="button" onClick={() => setMode('out')}
            className={`rounded-md px-4 py-2 text-sm font-semibold ${!giris ? 'bg-red-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
            {t.okutma.cikisMod}
          </button>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          {t.okutma.adetOkutma}
          <input type="number" min={1} value={qty}
            onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-20 rounded border px-2 py-1.5 text-center text-sm font-semibold tabular-nums" />
        </label>
      </div>

      {/* ── OKUTMA ALANI ────────────────────────────────────────────────
          <form> YOK: Enter doğrudan yakalanıyor, sayfa yenilenmiyor. */}
      <div className={`mt-4 rounded-lg border p-5 text-center ${giris ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
        <div className={`text-sm font-semibold ${giris ? 'text-emerald-800' : 'text-red-800'}`}>
          {giris ? t.okutma.girisHazir : t.okutma.cikisHazir}
        </div>
        <input value={manual} onChange={(e) => setManual(e.target.value)}
          placeholder={t.okutma.okutYer}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            // Değer STATE'ten değil DOM'dan okunuyor. Barkod okuyucu
            // karakterleri 15 ms'de basıp Enter'ı ekler; React güncellemeleri
            // topladığında Enter işleyicisi state'i henüz güncellenmemiş
            // görebiliyor ve eksik (hatta boş) kod gidiyordu — üstelik tam da
            // bu alanın var oluş sebebi olan hızlı okutmada. DOM her zaman
            // gerçek değeri tutar.
            const deger = (e.target as HTMLInputElement).value.trim();
            if (!deger) return;
            handleCode(deger);
            setManual('');
          }}
          className="mx-auto mt-3 w-full max-w-sm rounded border bg-white px-3 py-2 text-center text-sm" />
        <div className="mt-3 flex justify-center" onClick={(e) => e.stopPropagation()}>
          <CameraScanner onDetect={(c) => handleCode(c)} />
        </div>
        {/* İpucu metni renkli kutunun İÇİNDE: gri ton burada soluk kalıp
            okunmuyor. Kutunun kendi renginin koyu tonu kullanılıyor. */}
        <p className={`mt-3 text-xs ${giris ? 'text-emerald-800/80' : 'text-red-800/80'}`}>
          {t.okutma.ipucuOn} <b>{t.okutma.ipucuVurgu}</b>{t.okutma.ipucuSon}
        </p>
      </div>

      {/* ── BU OTURUM ───────────────────────────────────────────────── */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border bg-white p-4">
          <div className="text-2xl font-bold tabular-nums text-emerald-700">{girisSayisi}</div>
          <div className="text-sm text-gray-600">{t.okutma.oturumGiris}</div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-2xl font-bold tabular-nums text-red-700">{cikisSayisi}</div>
          <div className="text-sm text-gray-600">{t.okutma.oturumCikis}</div>
        </div>
      </div>

      {/* ── SON İŞLEMLER ────────────────────────────────────────────── */}
      <div className="mt-4 overflow-hidden rounded-lg border bg-white">
        <div className="border-b px-4 py-2.5 text-sm font-semibold text-gray-700">{t.okutma.sonIslemler}</div>
        {log.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-500">{t.okutma.okutmaYok}</p>
        ) : (
          <ul className="max-h-[46vh] divide-y overflow-y-auto">
            {log.map((e, i) => (
              <li key={i} className={`flex items-center gap-3 px-4 py-2.5 ${e.ok ? '' : 'bg-red-50'}`}>
                <span className={`w-14 shrink-0 text-sm font-bold tabular-nums ${
                  !e.ok ? 'text-red-700' : e.delta > 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                  {e.ok ? `${e.delta > 0 ? '+' : ''}${e.delta}` : '—'}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{e.text}</div>
                  {e.detail && (
                    <div className={`text-xs ${e.ok ? 'text-gray-500' : 'text-red-700'}`}>{e.detail}</div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
