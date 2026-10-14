'use client';

/**
 * KURULUMU BİRLİKTE YAPALIM — yeni hesabın panelinde, henüz müşteri yokken.
 *
 * Kayıt olan bayi boş bir panel görüyor; değer (kaçan sayaç, kaçan toner,
 * makinenin kendi bildirdiği arıza) ancak müşterileri ve makineleri içeri
 * girince başlıyor. En büyük engel bu ilk yük. Üç yol, bayi hangisini
 * kolay buluyorsa: listesini WhatsApp'tan göndermek (ekip yükler — adı konmuş
 * kurulum bonusu), Excel'den kendisi aktarmak, ekibini eklemek. İlk müşteri
 * girilince kart kendiliğinden kaybolur. Demoda çizilmez.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useT } from '@/lib/i18n/client';
import { doldur } from '@/lib/i18n/sozluk';

export default function KurulumKarti() {
  const t = useT();
  const k = t.kurulumKarti;
  const { data: session } = useSession();
  const demo = Boolean((session?.user as any)?.demo);
  const firma = ((session?.user as any)?.tenantName as string | undefined) ?? '';
  const [goster, setGoster] = useState(false);
  const [whatsapp, setWhatsapp] = useState('905526961703');

  useEffect(() => {
    if (demo) return;
    fetch('/api/onboarding/status').then((r) => r.json()).then((d) => setGoster(d?.steps && !d.steps.hasCustomers)).catch(() => {});
    fetch('/api/kayit').then((r) => r.json()).then((d) => { if (d?.whatsapp) setWhatsapp(d.whatsapp); }).catch(() => {});
  }, [demo]);

  if (!goster || demo) return null;
  const wa = `https://wa.me/${whatsapp}?text=${encodeURIComponent(doldur(k.waMesaj, { firma }))}`;
  const kutu = 'flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-4';
  return (
    <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 sm:p-5">
      <h2 className="text-[1.1rem] font-extrabold tracking-[-.01em] text-gray-900">{k.baslik}</h2>
      <p className="mt-1 max-w-3xl text-sm text-gray-600">{k.alt}</p>
      <div className="mt-3 grid grid-cols-1 gap-2.5 md:grid-cols-3">
        <div className={kutu}>
          <b className="text-gray-900">{k.gonderBaslik}</b>
          <span className="text-sm text-gray-500">{k.gonderAlt}</span>
          <a href={wa} target="_blank" rel="noopener" className="mt-auto rounded-lg bg-green-600 px-3 py-2 text-center text-sm font-bold text-white hover:bg-green-700">{k.gonderDugme}</a>
        </div>
        <div className={kutu}>
          <b className="text-gray-900">{k.excelBaslik}</b>
          <span className="text-sm text-gray-500">{k.excelAlt}</span>
          <Link href="/import" className="mt-auto rounded-lg border border-gray-300 px-3 py-2 text-center text-sm font-semibold text-gray-700 hover:bg-gray-50">{k.excelDugme}</Link>
        </div>
        <div className={kutu}>
          <b className="text-gray-900">{k.ekipBaslik}</b>
          <span className="text-sm text-gray-500">{k.ekipAlt}</span>
          <Link href="/users/new" className="mt-auto rounded-lg border border-gray-300 px-3 py-2 text-center text-sm font-semibold text-gray-700 hover:bg-gray-50">{k.ekipDugme}</Link>
        </div>
      </div>
    </section>
  );
}
