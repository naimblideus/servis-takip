import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { effectiveModules } from '@/lib/modules';
import Sidebar from '@/components/Sidebar';
import BottomNav from '@/components/BottomNav';
import ModuleGuard from '@/components/ModuleGuard';
import AccessLock from '@/components/AccessLock';
import Onboarding from '@/components/Onboarding';
import { sunucuDili } from '@/lib/i18n/sunucu';
import { LocaleProvider } from '@/lib/i18n/client';
import { dilMi } from '@/lib/i18n/sozluk';
import { paraBirimiMi, VARSAYILAN_BIRIM } from '@/lib/bicim';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) {
    redirect('/login');
  }

  // Tenant durumu + modüller + platform bakım ayarı — her gezinmede taze (askıya alma anında etkili)
  const tenantId = (session.user as any)?.tenantId as string | undefined;
  const [tenant, settings] = await Promise.all([
    tenantId
      ? prisma.tenant.findUnique({
          where: { id: tenantId },
          select: { plan: true, modules: true, marketEnabled: true, isActive: true, isSuspended: true, suspendReason: true, trialEndsAt: true, planEndDate: true, whatsappPhoneId: true, locale: true, currency: true, country: true },
        })
      : Promise.resolve(null),
    prisma.platformSettings.findFirst({ select: { maintenanceMode: true, contactEmail: true } }).catch(() => null),
  ]);

  // 0) OTURUM BAYAT — çereze yazılı bayi artık yok.
  // Oturum jetonu tenantId'yi taşıyor; kayıt silinip yeniden kurulduğunda
  // (süper-admin taşıması, demo hesabının tazelenmesi) eski kimlik ayakta
  // kalıyor. Eskiden bu sessizce `modules = []` demekti: kullanıcı giriş
  // yapmış görünüyor, ekranlar açılıyor ama her özellik "paketinizde yok"
  // diyordu. Ölçüldü — demo hesabı tazelendikten sonra Kaçan Gelir tam da
  // böyle kayboldu. Paketi olmayan bayiyle bayat oturumu ayırt edemeyen bir
  // ekran, satış görüşmesinin ortasında ürünü yoksun gösterir.
  // Doğrusu: kimlik geçersizse yeniden giriş istemek.
  if (tenantId && !tenant) {
    redirect('/login?hata=oturum-bayat');
  }

  // 1) Bakım modu — tüm tenant kullanıcıları
  if (settings?.maintenanceMode) {
    return <AccessLock title="Bakımdayız" message="Sistem kısa süreli bakımda. Lütfen birazdan tekrar deneyin." contactEmail={settings?.contactEmail} showLogout={false} />;
  }

  // 2) Abonelik kilidi — askıya alındı / deneme bitti / süre doldu / pasif
  if (tenant) {
    const now = Date.now();
    const trialExpired = tenant.plan === 'trial' && tenant.trialEndsAt && new Date(tenant.trialEndsAt).getTime() < now;
    const planExpired = !!tenant.planEndDate && new Date(tenant.planEndDate).getTime() < now;
    if (tenant.isActive === false || tenant.isSuspended || trialExpired || planExpired) {
      const reason = tenant.isSuspended
        ? (tenant.suspendReason || 'Aboneliğiniz askıya alındı.')
        : trialExpired ? 'Deneme süreniz doldu.'
          : planExpired ? 'Abonelik süreniz doldu.'
            : 'Hesabınız şu an pasif durumda.';
      return <AccessLock title="Erişim Kapalı" message={`${reason} Devam etmek için lütfen bizimle iletişime geçin.`} contactEmail={settings?.contactEmail} />;
    }
  }

  // ── DİL, PARA BİRİMİ, ÜLKE ──────────────────────────────────────────
  // Dil: çerez > kullanıcının kaydı > bayinin varsayılanı. Para birimi ve
  // ülke bayiden; ekranlar bunları bağlamdan alır, kendileri karar vermez.
  const kullaniciId = (session.user as any)?.id as string | undefined;
  const kullanici = kullaniciId
    ? await prisma.user.findUnique({ where: { id: kullaniciId }, select: { locale: true } }).catch(() => null)
    : null;
  const dil = await sunucuDili(kullanici?.locale, tenant?.locale);
  // Bayinin dili ayrıca taşınıyor: müşteriye giden mesaj/belge bununla
  // yazılıyor, ekrandaki kullanıcının diliyle değil.
  const bayiDili = dilMi(tenant?.locale) ? tenant.locale : dil;
  const birimAday = tenant?.currency;
  const birim = paraBirimiMi(birimAday) ? birimAday : VARSAYILAN_BIRIM;
  const ulke = tenant?.country ?? 'TR';

  const modules = tenant ? Array.from(effectiveModules(tenant)) : [];

  // ── MENÜDE NE GÖRÜNSÜN ───────────────────────────────────────────────
  // Kural: KULLANILMAYAN ŞEY HİÇ GÖSTERİLMEZ. Kurulmamış bir kanalı
  // "Gelişmiş" altında saklamak boş odayı kapatmak gibi — hâlâ orada.
  //
  // Bu bilgiler SUNUCUDA belirleniyor, istemci yoklamasıyla değil: yoklamayla
  // yapılsaydı menü öğesi sayfa açıldıktan sonra belirip kaybolurdu.
  //
  // Varlık kontrolü (findFirst + select:{id}) sayım yapmaktan ucuz ve
  // KARARLI: "hiç kullanılmış mı" cevabı bekleyen iş bitince değişmez, yani
  // menü öğesi grup değiştirip zıplamaz. Bekleyen SAYISI rozetten gelir.
  const [sayacEpostaVar, portalVar] = tenantId
    ? await Promise.all([
        prisma.counterEmail.findFirst({ where: { tenantId }, select: { id: true } }),
        prisma.customer.findFirst({ where: { tenantId, portalEnabled: true }, select: { id: true } }),
      ])
    : [null, null];

  const menuDurum = {
    whatsappKurulu: Boolean(tenant?.whatsappPhoneId),
    sayacEpostaKullaniliyor: Boolean(sayacEpostaVar),
    portalKullaniliyor: Boolean(portalVar),
  };

  return (
    <LocaleProvider dil={dil} birim={birim} ulke={ulke} bayiDili={bayiDili}>
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar modules={modules} durum={menuDurum} />
      <main id="app-main" className="flex-1 overflow-auto pt-14 md:pt-0 pb-20 md:pb-0 min-w-0">
        <ModuleGuard modules={modules}>{children}</ModuleGuard>
      </main>
      <BottomNav modules={modules} />
      <Onboarding />
    </div>
    </LocaleProvider>
  );
}
