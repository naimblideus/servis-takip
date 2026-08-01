'use client';

/**
 * Kategori seçilir seçilmez çıkan tek satırlık teşhis bilgisi.
 *
 * Amaç: kategoriyi "doldurulması gereken alan" olmaktan çıkarıp TEKNİSYENİN
 * KENDİ İŞİNE YARAYAN bir araca dönüştürmek. Doğru kategori seçilirse geçmiş
 * anlamlı çıkar; yanlış seçilirse işe yaramaz bilgi görür. Yani doğruluk,
 * zorlamayla değil çıkar hizalanmasıyla gelir.
 *
 * Dürüstlük kuralı: veri yetersizse YORUM YAPMAZ. Uydurma sayı/çıkarım yok.
 */
import { faultLabel, isFailure } from '@/lib/fault-categories';

export interface FaultHistory {
  windowDays: number;
  total: number;
  categorized: number;
  byCategory: Record<string, { count: number; lastAt: string }>;
  installedAt: string | null;
}

function deviceAgeText(installedAt: string | null): string | null {
  if (!installedAt) return null;
  const d = new Date(installedAt);
  if (Number.isNaN(d.getTime())) return null;
  const months = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 30.44));
  if (months < 0) return null;
  if (months < 12) return `${months} aylık cihaz`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m ? `${y} yıl ${m} aylık cihaz` : `${y} yıllık cihaz`;
}

export default function FaultInsight({
  history, category,
}: { history: FaultHistory | null; category: string }) {
  if (!history || !category) return null;

  const past = history.byCategory[category]?.count ?? 0;
  const nth = past + 1;                    // bu açılan fiş dahil kaçıncı
  const age = deviceAgeText(history.installedAt);
  const arizaMi = isFailure(category);
  // Tekrar uyarısı SADECE gerçek arızalar için. Periyodik bakımın tekrarlanması
  // normaldir; ona "tekrar eden arıza" demek yanlış sinyal üretir.
  const repeat = arizaMi && nth >= 3;

  // Kategorili kayıt yoksa geçmiş hakkında konuşma — sadece cihaz yaşı varsa onu göster
  const noHistoryData = history.categorized === 0;

  let text: string;
  if (noHistoryData) {
    if (!age) return null;
    text = age;
  } else if (past === 0) {
    text = arizaMi
      ? 'Bu cihazda bu arıza ilk kez kaydediliyor'
      : `Bu cihazda ilk ${faultLabel(category)} kaydı`;
  } else {
    text = `Bu cihazda son 12 ayda ${nth}. ${faultLabel(category)}`;
  }

  const tone = repeat
    ? { bg: '#fffbeb', border: '#fcd34d', fg: '#92400e', icon: '⚠️' }
    : { bg: '#f8fafc', border: '#e2e8f0', fg: '#475569', icon: 'ℹ️' };

  return (
    <div
      className="sa-slide"
      style={{
        marginTop: '0.55rem', padding: '0.55rem 0.75rem', borderRadius: '0.5rem',
        backgroundColor: tone.bg, border: `1px solid ${tone.border}`,
        display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap',
        fontSize: '0.82rem', color: tone.fg,
      }}
    >
      <span aria-hidden="true">{tone.icon}</span>
      <span style={{ fontWeight: repeat ? 600 : 400 }}>{text}</span>
      {repeat && <span style={{ opacity: 0.85 }}>— tekrar eden arıza, kök nedene bakın</span>}
      {age && !noHistoryData && (
        <span style={{ marginLeft: 'auto', opacity: 0.7, fontSize: '0.76rem' }}>{age}</span>
      )}
    </div>
  );
}
