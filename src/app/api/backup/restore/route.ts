import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { getSuperAdminSession } from '@/lib/super-admin-auth';
import { writeAudit, istekIp } from '@/lib/audit';
import {
  YAZMA_SIRASI, MODEL_ADI, dogrulaYedek, hazirlaSatirlar,
  hazirlaKullanicilar, hazirlaFirmaAyarlari, dosyadaBolumVar,
} from '@/lib/backup-restore';

/**
 * POST /api/backup/restore — /api/backup çıktısını geri yükler.
 *
 * ── NEDEN YALNIZ SÜPER-ADMIN ─────────────────────────────────────────────
 * Geri yükleme, hedef kiracının mevcut verisini SİLER. Bayinin kendi
 * panelinden yanlışlıkla 6 ay öncesinin yedeğini yüklemesi, kurtardığından
 * çok daha büyük bir kayıp olur. Bu bir kurtarma aracıdır, bir düğme değil.
 *
 * ── İKİ AŞAMA ────────────────────────────────────────────────────────────
 * Varsayılan ÖNİZLEME'dir: ne yazılacağı ve ne silineceği sayılır, hiçbir şey
 * değişmez. Uygulamak için firma adının harfi harfine yazılması gerekir.
 */
export async function POST(req: NextRequest) {
  const sa = await getSuperAdminSession();
  if (!sa) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let govde: any;
  try { govde = await req.json(); } catch { return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 }); }

  const { tenantId, backup, onay } = govde as { tenantId?: string; backup?: any; onay?: string };
  if (!tenantId) return NextResponse.json({ error: 'Hedef bayi seçilmedi' }, { status: 400 });

  const hedef = await prisma.tenant.findFirst({ where: { id: tenantId, deletedAt: null }, select: { id: true, name: true } });
  if (!hedef) return NextResponse.json({ error: 'Hedef bayi bulunamadı' }, { status: 404 });

  const kontrol = dogrulaYedek(backup);

  // Hedefte HÂLİHAZIRDA ne var — silinecek olan bu.
  const [mCustomers, mDevices, mTickets, mReadings, mInvoices, mPayments, mKasa, mGider] = await Promise.all([
    prisma.customer.count({ where: { tenantId } }),
    prisma.device.count({ where: { tenantId } }),
    prisma.serviceTicket.count({ where: { tenantId } }),
    prisma.counterReading.count({ where: { tenantId } }),
    prisma.customerInvoice.count({ where: { tenantId } }),
    prisma.payment.count({ where: { tenantId } }),
    prisma.financialTransaction.count({ where: { tenantId } }),
    prisma.expense.count({ where: { tenantId } }),
  ]);
  // Yalnız DOSYADA BÖLÜMÜ OLAN tablolar silinir; olmayanlar 0 gösterilir ki
  // önizleme yalan söylemesin.
  const silinecek = {
    musteri: mCustomers, cihaz: mDevices, fis: mTickets, sayac: mReadings,
    fatura: mInvoices, tahsilat: mPayments,
    kasa: dosyadaBolumVar(backup, 'financialTransactions') ? mKasa : 0,
    gider: dosyadaBolumVar(backup, 'expenses') ? mGider : 0,
  };
  const hedefBos = Object.values(silinecek).every((n) => n === 0);

  const onizleme = {
    hedefBayi: hedef.name,
    kaynakFirma: kontrol.kaynakFirma,
    yedekTarihi: kontrol.olusturma,
    yazilacak: kontrol.sayimlar,
    silinecek,
    hedefBos,
    kullaniciSayisi: kontrol.kullaniciSayisi,
    hatalar: kontrol.hatalar,
    uyarilar: kontrol.uyarilar,
  };

  if (!kontrol.ok) return NextResponse.json({ ...onizleme, uygulandi: false }, { status: 400 });

  // Onay yoksa ya da yanlışsa: burada durur, hiçbir şey değişmez.
  if (onay !== hedef.name) {
    return NextResponse.json({
      ...onizleme,
      uygulandi: false,
      onayGerekli: `Uygulamak için "onay" alanına birebir şunu yazın: ${hedef.name}`,
    });
  }

  const satirlar = hazirlaSatirlar(backup, tenantId);
  // Hiçbir parolayla eşleşmeyen özet: bcrypt biçiminde olmadığı için compare her zaman false döner.
  const girilemez = 'geri-yukleme-girilemez-' + crypto.randomBytes(24).toString('hex');
  const kullanicilar = hazirlaKullanicilar(backup, tenantId, girilemez);
  const firmaAyar = hazirlaFirmaAyarlari(backup);

  try {
    const yazilan: Record<string, number> = {};
    await prisma.$transaction(async (tx) => {
      // 1) Sil — yazma sırasının TERSİ (FK'ler bozulmasın).
      //    Kullanıcılar SİLİNMEZ: bayiyi kendi sisteminden kilitlemek olurdu.
      //    Dosyada BÖLÜMÜ OLMAYAN tabloya dokunulmaz: eski sürüm yedeklerinde
      //    kasa/gider/stok bölümü yok; boş yazmak onları yok ederdi.
      for (const t of [...YAZMA_SIRASI].reverse()) {
        if (!dosyadaBolumVar(backup, t)) continue;
        await (tx as any)[MODEL_ADI[t]].deleteMany({ where: { tenantId } });
      }

      // 2) Eksik kullanıcıları oluştur — fişlerin createdByUserId'si ZORUNLU.
      if (kullanicilar.length) {
        await tx.user.createMany({ data: kullanicilar as any, skipDuplicates: true });
      }

      // 3) Yaz — FK'ye güvenli sırada.
      for (const t of YAZMA_SIRASI) {
        if (!dosyadaBolumVar(backup, t)) { yazilan[t] = 0; continue; }
        const veri = satirlar[t];
        if (!veri.length) { yazilan[t] = 0; continue; }
        const r = await (tx as any)[MODEL_ADI[t]].createMany({ data: veri, skipDuplicates: true });
        yazilan[t] = r.count;
      }

      // 4) Firma ayarları (ad hariç)
      if (firmaAyar) await tx.tenant.update({ where: { id: tenantId }, data: firmaAyar as any });
    }, { timeout: 120_000 });

    await writeAudit({
      tenantId,
      action: 'YEDEKTEN_GERI_YUKLENDI',
      entityType: 'Tenant',
      entityId: tenantId,
      oldValue: silinecek,
      newValue: { yazilan, kaynakFirma: kontrol.kaynakFirma, yedekTarihi: kontrol.olusturma, kullanici: kullanicilar.length },
      ipAddress: istekIp(req),
      actorType: 'SUPER_ADMIN',
      actorName: sa.email,
    });

    return NextResponse.json({ ...onizleme, uygulandi: true, yazilan });
  } catch (e: any) {
    // Transaction geri alındı — hedefteki veri olduğu gibi duruyor.
    console.error('[restore] başarısız:', e?.message);
    return NextResponse.json(
      { ...onizleme, uygulandi: false, error: `Geri yükleme başarısız, hiçbir değişiklik yapılmadı: ${e?.message ?? 'bilinmeyen hata'}` },
      { status: 500 },
    );
  }
}
