import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSuperAdminSession } from '@/lib/super-admin-auth';

/**
 * CSV hücresi: Türkçe Excel noktalı virgülle ayırır; tırnak kaçışı; "=", "+",
 * "-", "@" ile başlayan değer formül sanılıp çalışmasın diye başına kesme
 * işareti (ziyaretçinin yazdığı firma adı hücre formülü olmamalı).
 */
const hucre = (v: unknown): string => {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
};

const waBaglanti = (t: string | null): string => {
  if (!t) return '';
  let d = t.replace(/\D/g, '');
  if (d.startsWith('0')) d = '90' + d.slice(1);
  else if (d.length === 10) d = '90' + d;
  return d ? `https://wa.me/${d}` : '';
};

// GET /api/super-admin/leads — siteden gelen talepler (yenisi üstte).
//   ?hepsi=1        okunmuşlar dahil
//   ?kaynak=pantum  yalnız o kaynaktan (etkinlik QR'ı, kayıt, landing…)
//   ?bicim=csv      Excel'de açılan dosya (ekibe dağıtmak için)
export async function GET(req: NextRequest) {
  const admin = await getSuperAdminSession();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sp = new URL(req.url).searchParams;
  const hepsi = sp.get('hepsi') === '1';
  const kaynak = (sp.get('kaynak') ?? '').trim().slice(0, 80);
  const where = { ...(hepsi ? {} : { okundu: false }), ...(kaynak ? { kaynak } : {}) };
  // Bir etkinlik yüzlerce talep getirebilir: eski 300 sınırı ekibe dağıtılacak listeyi kesiyordu.
  const leads = await prisma.lead.findMany({ where, orderBy: { createdAt: 'desc' }, take: 1000 });

  if (sp.get('bicim') === 'csv') {
    const baslik = ['Tarih', 'Firma', 'Yetkili', 'Telefon', 'WhatsApp', 'E-posta', 'Cihaz', 'Kaynak', 'Kampanya', 'Mesaj', 'Durum'];
    const satirlar = leads.map((l) => [
      l.createdAt.toISOString().slice(0, 16).replace('T', ' '), l.firma, l.yetkili, l.telefon, waBaglanti(l.telefon),
      l.eposta, l.cihazSayisi, l.kaynak, l.kampanya, l.mesaj, l.okundu ? 'ilgilenildi' : 'bekliyor',
    ].map(hucre).join(';'));
    const govde = '\uFEFF' + [baslik.map(hucre).join(';'), ...satirlar].join('\r\n') + '\r\n';
    const ad = `talepler${kaynak ? `-${kaynak.replace(/[^a-z0-9-]/gi, '')}` : ''}.csv`;
    return new NextResponse(govde, {
      headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${ad}"`, 'Cache-Control': 'no-store' },
    });
  }

  const [bekleyen, kaynakSayilari] = await Promise.all([
    prisma.lead.count({ where: { okundu: false, ...(kaynak ? { kaynak } : {}) } }),
    prisma.lead.groupBy({ by: ['kaynak'], _count: { _all: true } }),
  ]);
  const kaynaklar = kaynakSayilari
    .filter((k) => k.kaynak)
    .map((k) => ({ kaynak: k.kaynak as string, adet: k._count._all }))
    .sort((a, b) => b.adet - a.adet);
  return NextResponse.json({ leads, bekleyen, kaynaklar });
}

// PATCH — okundu işaretle / geri al
export async function PATCH(req: NextRequest) {
  const admin = await getSuperAdminSession();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, okundu } = await req.json();
  if (!id) return NextResponse.json({ error: 'id zorunlu' }, { status: 400 });

  await prisma.lead.update({ where: { id }, data: { okundu: okundu !== false } });
  return NextResponse.json({ ok: true });
}
