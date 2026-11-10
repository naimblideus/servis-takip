import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { oturumKullanicisi, yoneticiMi } from '@/lib/api-auth';
import { sunucuBicimi } from '@/lib/i18n/sunucu-bicim';
import { ayarHazirla, siparisAdresi, siteKoku } from '@/lib/matbaa-ayar-kayit';
import { hizliYanitlar } from '@/lib/matbaa-ayar';
import { r2Ayarli } from '@/lib/r2';
import AyarFormu from '@/components/matbaa/AyarFormu';

export const dynamic = 'force-dynamic';

/**
 * SİPARİŞ SAYFASI AYARLARI — yalnız sahip. Adres, açık/kapalı, saatler ve
 * WhatsApp'a bir kez yapıştırılacak hazır metinler. IBAN ve işletme adresi
 * genel Ayarlar ekranında (Tenant); burada yalnız okunur.
 */
export default async function MatbaaAyarlari() {
  const session = await auth();
  if (!session) return null;
  const user = await oturumKullanicisi(session);
  if (!user) return null;
  if (!yoneticiMi(user)) redirect('/matbaa');
  const { bayiDili } = await sunucuBicimi(user);
  const [ayar, tenant] = await Promise.all([
    ayarHazirla(user.tenantId),
    prisma.tenant.findUnique({ where: { id: user.tenantId }, select: { name: true, address: true, odemeIban: true, odemeHesapAdi: true } }),
  ]);
  // Yanıtlar müşteriye gider: BAYİNİN dilinde.
  const yanitlar = hizliYanitlar({
    firma: tenant?.name ?? '', siparisUrl: siparisAdresi(ayar), adres: tenant?.address,
    iban: tenant?.odemeIban, hesapAdi: tenant?.odemeHesapAdi, calisma: ayar.calismaSaatleri, ozelKarsilama: ayar.karsilamaMetni,
  }, bayiDili);
  return (
    <AyarFormu
      kok={`${siteKoku()}/b/`}
      ilk={{
        kisaAd: ayar.kisaAd ?? '', siparisAcik: ayar.siparisAcik, calismaSaatleri: ayar.calismaSaatleri ?? '',
        hazirlamaSaat: ayar.hazirlamaSaat, havaleKabul: ayar.havaleKabul, saklamaGun: ayar.saklamaGun, karsilamaMetni: ayar.karsilamaMetni ?? '',
      }}
      ibanVar={!!tenant?.odemeIban}
      dosyaAcik={r2Ayarli()}
      yanitlar={yanitlar}
    />
  );
}
