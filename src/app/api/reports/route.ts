import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { oturumKullanicisi } from '@/lib/api-auth';
import { csvMetni, csvSayi, csvBasliklari, csvDosyaAdi } from '@/lib/csv';
import { raporOzeti, DURUM_ADI, ONCELIK_ADI } from '@/lib/rapor-ozeti';

export async function GET(req: Request) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await oturumKullanicisi(session);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Hesap TEK YERDE: ekran, CSV ve yazdırma sayfası aynı fonksiyondan
    // besleniyor. Ayrı sorgu yazmak, aynı raporun ekranda başka kâğıtta başka
    // rakam göstermesi demekti.
    const o = await raporOzeti(user.tenantId);

    // ── CSV ──────────────────────────────────────────────────────────────
    if (new URL(req.url).searchParams.get('format') === 'csv') {
        const satirlar: unknown[][] = [];
        // Tek dosyada üç blok. "Bölüm" sütunu ilk sırada ki bayi Excel'de
        // süzerek istediği bloğu tek başına görebilsin.
        satirlar.push(['Özet', 'Toplam fiş', o.toplamlar.fis, '']);
        satirlar.push(['Özet', 'Müşteri', o.toplamlar.musteri, '']);
        satirlar.push(['Özet', 'Cihaz', o.toplamlar.cihaz, '']);
        // Bu satır TÜM fişlerin tutarı — tahsil edilmiş olsun olmasın.
        // Aylık bloktaki ciro ise yalnız ödenmişleri sayar; başlıklar farkı söylüyor.
        satirlar.push(['Özet', 'Toplam iş hacmi (₺)', '', csvSayi(o.toplamlar.ciro)]);
        for (const m of o.aylik) satirlar.push(['Aylık', m.label, m.adet, csvSayi(m.ciro)]);
        for (const d of o.durumlar) satirlar.push(['Durum', DURUM_ADI[d.durum] ?? d.durum, d.adet, '']);
        for (const p of o.oncelikler) satirlar.push(['Öncelik', ONCELIK_ADI[p.oncelik] ?? p.oncelik, p.adet, '']);

        const metin = csvMetni(
            ['Bölüm', 'Kalem', 'Adet', 'Tutar (₺)'],
            satirlar,
        );
        return new NextResponse(metin, {
            headers: csvBasliklari(csvDosyaAdi('rapor-ozet', new Date().toISOString().slice(0, 10))),
        });
    }

    // Ekranın beklediği alan adları korunuyor — arayüz değişmesin.
    return NextResponse.json({
        totals: {
            tickets: o.toplamlar.fis,
            customers: o.toplamlar.musteri,
            devices: o.toplamlar.cihaz,
            revenue: o.toplamlar.ciro,
        },
        byStatus: o.durumlar.map((d) => ({ status: d.durum, _count: d.adet })),
        byPriority: o.oncelikler.map((p) => ({ priority: p.oncelik, _count: p.adet })),
        monthlyData: o.aylik.map((m) => ({ label: m.label, count: m.adet, revenue: m.ciro })),
    });
}
