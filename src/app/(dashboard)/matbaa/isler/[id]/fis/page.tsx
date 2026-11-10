import { notFound, redirect } from 'next/navigation';
import QRCode from 'qrcode';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { oturumKullanicisi } from '@/lib/api-auth';
import { matbaaMetni } from '@/lib/matbaa-metin';
import { musteriMetni } from '@/lib/matbaa-musteri-metin';
import { doldur, dilMi } from '@/lib/i18n/sozluk';
import { bicimYap } from '@/lib/bicim';
import { saatYaz, tl } from '@/lib/matbaa-bicim';
import { isNo, kalan } from '@/lib/baski-is';
import { ayarHazirla, takipAdresi } from '@/lib/matbaa-ayar-kayit';
import PrintNowButton from '@/components/PrintNowButton';

export const dynamic = 'force-dynamic';

/**
 * İŞ FİŞİ — müşteriye verilen küçük kâğıt (80 mm fiş yazıcısına da sığar).
 * Üstünde iş numarası ve takip sayfasının QR'ı: "hazır mı?" diye yazmak
 * yerine telefonla okutur. Fiş müşteriye gider: dil ve para birimi BAYİDEN.
 * Operatör tutar görmediği için fişi de açamaz.
 */
export default async function IsFisi({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) redirect('/login');
  const user = await oturumKullanicisi(session);
  if (!user) redirect('/login');
  const { id } = await params;
  if (user.role === 'TECHNICIAN') redirect(`/matbaa/isler/${id}`);
  const is = await prisma.baskiIsi.findFirst({
    where: { id, tenantId: user.tenantId },
    include: { kalemler: { orderBy: { sira: 'asc' } }, tenant: { select: { name: true, phone: true, address: true, locale: true, currency: true, workTimezone: true } } },
  });
  if (!is) notFound();
  const dil = dilMi(is.tenant.locale) ? is.tenant.locale : 'tr';
  const m = musteriMetni(dil);
  const p = matbaaMetni(dil);
  const b = bicimYap(dil, is.tenant.currency);
  const tz = is.tenant.workTimezone || 'Europe/Istanbul';
  const takip = takipAdresi(await ayarHazirla(user.tenantId), is.jeton);
  const qr = takip ? await QRCode.toString(takip, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' }) : null;
  const kalanTutar = kalan(is.toplam, is.odenen);

  return (
    <>
      <PrintNowButton etiket={p.fisYazdirDugme} />
      <div className="mx-auto w-[76mm] bg-white p-3 text-[12px] leading-snug text-black">
        <div className="text-center">
          <div className="text-[15px] font-bold">{is.tenant.name}</div>
          {is.tenant.phone && <div>{is.tenant.phone}</div>}
          {is.tenant.address && <div className="text-[11px]">{is.tenant.address}</div>}
        </div>
        <div className="my-2 border-t border-dashed border-black" />
        <div className="text-center font-mono text-[22px] font-bold">{isNo(is.no)}</div>
        <div className="text-center text-[11px]">{saatYaz(is.createdAt, dil, tz, new Date(0))}{is.musteriAd ? ` · ${is.musteriAd}` : ''}</div>
        <div className="my-2 border-t border-dashed border-black" />
        {is.kalemler.map((k) => (
          <div key={k.id} className="flex justify-between gap-2 py-0.5">
            <span>{k.ozet}</span><span className="shrink-0 tabular-nums">{b.para(tl(k.tutar))}</span>
          </div>
        ))}
        <div className="my-2 border-t border-dashed border-black" />
        <div className="flex justify-between font-bold"><span>{m.toplam} ({m.kdvDahil})</span><span className="tabular-nums">{b.para(tl(is.toplam))}</span></div>
        {is.odenen > 0 && <div className="flex justify-between"><span>{m.odenen}</span><span className="tabular-nums">{b.para(tl(is.odenen))}</span></div>}
        {kalanTutar > 0 && <div className="flex justify-between font-bold"><span>{m.kalan}</span><span className="tabular-nums">{b.para(tl(kalanTutar))}</span></div>}
        {is.sozVerilenAt && <div className="mt-2 text-center font-semibold">{doldur(m.sozSaat, { saat: saatYaz(is.sozVerilenAt, dil, tz, new Date(0)) })}</div>}
        {qr && (
          <div className="mt-3 text-center">
            <div className="mx-auto h-[34mm] w-[34mm]" dangerouslySetInnerHTML={{ __html: qr }} />
            <div className="mt-1 text-[11px] font-semibold">{p.fisTakip}</div>
          </div>
        )}
      </div>
    </>
  );
}
