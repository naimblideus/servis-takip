'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import CameraScanner from '@/components/CameraScanner';
import { useT } from '@/lib/i18n/client';
import { MARKA_ONERILERI } from '@/lib/device-brands';
import { BILINMIYOR, seriBekliyor } from '@/lib/gecici-kimlik';

/**
 * CİHAZI TANIMLA — telefonda "bilmiyorum" diye açılan cihazı teknisyen sahada
 * tamamlar: etiketteki seri numarası (kamerayla okutarak ya da yazarak),
 * marka/model ve kiralık mı.
 *
 * Yalnız seri no'su bekleyen (GEC-/IMP-) ya da markası/modeli "Bilinmiyor"
 * olan cihazda görünür. Seri numarası sayaç e-postasının ve ağ tarayıcının
 * cihazı tanıdığı anahtardır; girilmeden sayaç kendiliğinden gelmez.
 *
 * "Kiralık mı" yalnız DEĞİŞTİRİLİRSE gönderilir: Excel'den kira bilgisiyle
 * gelmiş ama seri no'su olmayan cihazda kira bilgisi silinmesin (cihaz ucu
 * kiralık değil denince kira ve paketi sıfırlar).
 */
export default function CihazTanimla({ cihaz }: {
  cihaz: { id: string; serialNo: string; brand: string; model: string; isRental: boolean };
}) {
  const t = useT();
  const k = t.cihazTanimla;
  const router = useRouter();
  const [seri, setSeri] = useState(seriBekliyor(cihaz.serialNo) ? '' : cihaz.serialNo);
  const [marka, setMarka] = useState(cihaz.brand === BILINMIYOR ? '' : cihaz.brand);
  const [model, setModel] = useState(cihaz.model === BILINMIYOR ? '' : cihaz.model);
  const [kiralik, setKiralik] = useState(cihaz.isRental);
  const [mesgul, setMesgul] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [tamam, setTamam] = useState(false);

  const kaydet = async () => {
    setHata(null);
    const govde: Record<string, unknown> = {};
    if (seri.trim()) govde.serialNo = seri.trim();
    if (marka.trim() || model.trim()) { govde.brand = marka.trim() || BILINMIYOR; govde.model = model.trim() || BILINMIYOR; }
    if (kiralik !== cihaz.isRental) govde.isRental = kiralik;
    if (!Object.keys(govde).length) { setHata(k.bos); return; }
    setMesgul(true);
    try {
      const r = await fetch(`/api/devices/${encodeURIComponent(cihaz.id)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(govde),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setHata(d.error || t.genel.baglantiHatasi); return; }
      setTamam(true);
      router.refresh();
    } catch {
      setHata(t.genel.baglantiHatasi);
    } finally {
      setMesgul(false);
    }
  };

  if (tamam) return <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{k.kaydedildi}</div>;

  const kutu = 'min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm';
  return (
    <section aria-labelledby="cihaz-tanimla" className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <h3 id="cihaz-tanimla" className="text-base font-bold text-amber-900">{k.baslik}</h3>
      <p className="mt-1 text-sm text-amber-900/80">{k.aciklama}</p>
      <div className="mt-3 space-y-3">
        <div>
          <label className="mb-1 block text-xs font-semibold text-amber-950" htmlFor={`seri-${cihaz.id}`}>{k.seri}</label>
          <input id={`seri-${cihaz.id}`} className={kutu} value={seri} onChange={(e) => setSeri(e.target.value)} autoComplete="off" autoCapitalize="characters" placeholder={k.seriYer} />
          {/* Kamera düğmesi barkod okumayı destekleyen tarayıcıda (Android) çalışır; iPhone'da elle yazılır. */}
          <div className="mt-2"><CameraScanner onDetect={(kod) => setSeri(kod.trim())} /></div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-amber-950" htmlFor={`marka-${cihaz.id}`}>{k.marka}</label>
            <input id={`marka-${cihaz.id}`} className={kutu} value={marka} onChange={(e) => setMarka(e.target.value)} list="cihaz-tanimla-marka" autoComplete="off" />
            <datalist id="cihaz-tanimla-marka">{MARKA_ONERILERI.map((m) => <option key={m} value={m} />)}</datalist>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-amber-950" htmlFor={`model-${cihaz.id}`}>{k.model}</label>
            <input id={`model-${cihaz.id}`} className={kutu} value={model} onChange={(e) => setModel(e.target.value)} autoComplete="off" />
          </div>
        </div>
        <fieldset>
          <legend className="mb-1 text-xs font-semibold text-amber-950">{k.kiralikMi}</legend>
          <div className="flex gap-2">
            {[true, false].map((v) => (
              <button key={String(v)} type="button" onClick={() => setKiralik(v)} aria-pressed={kiralik === v}
                className={`min-h-11 flex-1 rounded-lg border text-sm font-semibold ${kiralik === v ? 'border-amber-600 bg-amber-600 text-white' : 'border-gray-300 bg-white text-gray-700'}`}>
                {v ? k.evet : k.hayir}
              </button>
            ))}
          </div>
          {kiralik && !cihaz.isRental && <p className="mt-1 text-xs text-amber-900/80">{k.kiraNot}</p>}
        </fieldset>
        {hata && <p role="alert" className="text-sm text-red-700">{hata}</p>}
        <button type="button" onClick={kaydet} disabled={mesgul} className="min-h-11 w-full rounded-lg bg-amber-600 px-4 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-60">
          {mesgul ? t.genel.kaydediliyor : k.kaydet}
        </button>
      </div>
    </section>
  );
}
