'use client';

import { useState } from 'react';
import Link from 'next/link';

interface Section { id: string; icon: string; title: string; intro?: string; steps: string[]; tip?: string }

const SECTIONS: Section[] = [
  {
    id: 'musteri', icon: '👤', title: 'Müşteri ekleme (ve Excel’den toplu aktarma)',
    steps: [
      'Tek tek: Sol menü → Müşteriler → “＋ Yeni Müşteri”. Ad ve telefon zorunlu.',
      'TOPLU: Elinde müşteri/cihaz listesi varsa → Gelişmiş → Veri Aktarma → “Excel / CSV listesi”.',
      'Excel’de: Dosya → Farklı Kaydet → “CSV UTF-8”. Sonra dosyayı seç — kolonları sistem kendi tanır.',
      'Önizlemede ilk satırları kontrol et, yanlış eşleşen kolon varsa açılır menüden düzelt → Aktar.',
      'Aynı telefon/seri no zaten varsa güncellenir, kopyası oluşmaz — tekrar çalıştırmak güvenlidir.',
    ],
    tip: 'Adresi düzgün girersen müşteri kartındaki “Yol Tarifi” tek dokunuşla navigasyon başlatır.',
  },
  {
    id: 'cihaz', icon: '🖨️', title: 'Cihaz ekleme + kiralama ayarları',
    steps: [
      'Müşteri detayı ya da Cihazlar → “＋ Yeni Cihaz”. Marka, model, seri no gir.',
      'Kiralıksa “Kiralık” işaretle → aylık kira + sayfa fiyatlarını gir. Pakete dahil sayfa varsa “dahil” alanlarına yaz (yalnız aşan sayfa faturalanır).',
      'KONUM (kat/oda) yaz — sayaç turu ve cihaz dökümü bu sıraya göre dizilir, saha işini çok kolaylaştırır.',
      'Cihaza otomatik QR üretilir; “QR Kod” ile basıp makineye yapıştırabilirsin.',
    ],
  },
  {
    id: 'fis', icon: '🧾', title: 'Servis fişi açma (günlük ana iş)',
    steps: [
      'Servis Fişleri → “＋ Yeni Fiş” (telefonda: alttaki ＋ → Yeni Servis Fişi).',
      'Müşteri + cihaz seç, arızayı yaz.',
      'Kullanılan parçaları ekle — barkod okuyucun varsa parçayı okut, otomatik bulunur ve stoktan düşer.',
      'İş bitince durumu “Teslim Edildi” yap. Fiş tutarı otomatik olarak müşterinin cari hesabına borç yazılır.',
      '“🖨️ Yazdır” ile müşteriye imzalı fiş çıktısı verebilirsin.',
    ],
    tip: 'Durumu 3 gündür değişmeyen fişler ana ekranda “Duran İşler” olarak turuncu görünür — müşteri beklemede kalmaz.',
  },
  {
    id: 'sayac', icon: '🔢', title: 'Sayaç okuma — “Sayaç Turu” ile toplu',
    intro: 'Kiralık cihazın parası sayaçtan çıkar. Ayda bir okumak yeterli.',
    steps: [
      'Sol menü → Sayaç Turu → müşteriyi seç.',
      'O müşterinin TÜM kiralık cihazları kat/oda sırasına dizili tek listede çıkar.',
      'Her cihaz için yalnızca YENİ rakamı yaz — fark (kaç sayfa çekilmiş) anında görünür.',
      'Altta “12/60 okundu” yazar; “Kaydet”e bas, hepsi tek seferde işlenir.',
      'Sayaç önceki değerden düşükse satır kırmızı kalır. Cihaz sıfırlandıysa/değiştiyse “sayaç sıfırlandı” kutusunu işaretle, tekrar dene.',
    ],
    tip: 'Cihaz dökümünü “sayaç sütunu boş” yazdırıp kâğıtla gezebilir, sonra sisteme girebilirsin.',
  },
  {
    id: 'fatura', icon: '📄', title: 'Faturalama (ay sonu)',
    steps: [
      'Gelişmiş → Faturalar → “⚡ Bu Dönemi Faturala”.',
      'ÖNCE KONTROL: Sistem “şu 5 cihazın sayacı okunmadı” diye uyarır — eksik aşım faturası gitmesin.',
      'İstersen “Önce sayaçları oku” ile Sayaç Turu’na gidersin, ya da “Yine de faturala” dersin.',
      'Sayaç + kira + ödenmemiş servis TEK faturada birleşir.',
      'Faturanın arkasına otomatik SAYAÇ EKİ eklenir: her cihazın önceki → yeni sayacı, çekilen sayfa, aşım ve tutar. Müşteri “niye bu kadar?” diye sormaz.',
    ],
  },
  {
    id: 'tahsilat', icon: '💰', title: 'Muhasebe, tahsilat ve borç hatırlatma',
    steps: [
      'Muhasebe = cari hesap. Her fiş borç, her ödeme alacak olarak işlenir; bakiye otomatik hesaplanır.',
      'Ödeme gelince: Muhasebe → müşteri → tahsilat gir. Borç kendiliğinden düşer.',
      'Kiralık cihazın aylık kira/sayaç bedelini cariye elle eklemek istersen: müşteri detayında “🖨️🔢 Kira/Sayaç Ekle” (hesaplar, sen onaylayınca cariye düşer).',
      'BORÇ HATIRLATMA: Muhasebe → “📩 Toplu Hatırlatma” → borçluları seç → SMS ile topluca gönder ya da WhatsApp’tan tek tek.',
      'Ekstre: müşteri detayında “Yazdır” — tüm hareketler + bakiye tek sayfada.',
    ],
    tip: 'Bakiye yeşil “Alacak (Kredi)” görünüyorsa müşteri fazla ödemiş demektir.',
  },
  {
    id: 'ciktilar', icon: '🖨️', title: 'Çıktılar — hangi kâğıt nereden çıkar',
    steps: [
      'Servis fişi: fiş detayı → “🖨️ Yazdır” (müşteri imzalı nüsha).',
      'İCMAL (çok fiş tek sayfada): Servis Fişleri → tarih aralığı + müşteri filtrele → “🖨️ İcmal Yazdır”. 100 fiş ≈ 3 sayfa.',
      'CİHAZ DÖKÜMÜ / ZİMMET: müşteri detayı → “🖨️ Döküm”. Kat/oda gruplu tüm cihazlar + imza alanı. “Sayaç sütunu boş” seçeneği saha föyü olur.',
      'Fatura ve tahsilat makbuzu: ilgili kayıtta “Yazdır”.',
      'Barkod/QR etiketi: Zebra Etiket ekranı (termal yazıcı).',
    ],
  },
  {
    id: 'patron', icon: '📊', title: 'Patron ekranı — ne kontrol etmeli',
    steps: [
      'ANA SAYFA: “Duran İşler” (3+ gündür kımıldamayan fişler), “Sözleşme Uyarısı” (biten/bitmek üzere olan kiralama sözleşmeleri), borçlu müşteriler. Sorun yoksa bu bölümler görünmez.',
      'Sözleşme tarihini girmek için: müşteri → Düzenle → “Sözleşme Bitiş Tarihi”.',
      'Gelişmiş → Cihaz Kârlılığı: hangi kiralık makine kazandırıyor, hangisi zarar ediyor (gelir − parça maliyeti).',
      'Gelişmiş → Toplu Zam: müşteri/cihaz süz → %X zam → önizleme → uygula → zam listesini yazdır.',
      'Gelişmiş → Kaçan Gelir: faturalanmamış sayaç/kira burada birikir.',
    ],
  },
  {
    id: 'saha', icon: '🗺️', title: 'Sahada: rota, telefon ve QR',
    steps: [
      'TELEFON: Siteyi telefonda aç → tarayıcı menüsünden “Ana Ekrana Ekle” → uygulama gibi tam ekran açılır.',
      'Altta sekme çubuğu: Ana · Fişler · ＋ (hızlı işlem) · Pazar · Muhasebe.',
      'Rota (Gelişmiş): açık fişli müşteriler durak durak listelenir, haritada sıralı yol tarifi alırsın.',
      'QR ARIZA: cihazdaki QR’ı müşteri okutur → giriş gerekmeden arıza bildirir → sisteminde otomatik fiş oluşur.',
      'Her müşteride 📞 Ara · 💬 WhatsApp · 🗺️ Yol Tarifi butonları hazırdır.',
    ],
  },
  {
    id: 'pazar', icon: '🤝', title: 'Bayi Pazarı (diğer bayilerle al-sat)',
    steps: [
      'Sol menü → Bayi Pazarı → “Pazara Katıl” (yalnız yönetici açabilir). Her pakete dahildir, ücretsizdir.',
      'İlan ver: elindeki fazla parçayı/makineyi sat. Stoktan seçerek bilgileri otomatik doldurabilirsin.',
      'Satın al: ihtiyacın olan parçayı ağdaki bayilerde ara, mesaj at, sipariş ver.',
      'Sipariş “Teslim aldım” yapılınca stok ve muhasebe kayıtları HER İKİ tarafta otomatik oluşur.',
      'Telefonun ilanda görünmez; önce uygulama içi mesajlaşılır.',
    ],
  },
  {
    id: 'guvenlik', icon: '🔐', title: 'Güvenlik ve yedek',
    steps: [
      'YEDEK: Ayarlar → “💾 Verinin Yedeği” → “Yedeği indir”. Tüm müşteri, cihaz, fiş ve muhasebe kaydın bilgisayarına iner. Ayda bir alman yeterli.',
      'İKİ ADIMLI DOĞRULAMA (isteğe bağlı): Ayarlar → “🔐 İki Adımlı Doğrulama” → “Kur ve Aç” → telefonundaki Google Authenticator ile QR’ı okut → çıkan 6 haneli kodu gir.',
      'Açarsan girişte şifrenin yanında kod da istenir; şifren çalınsa bile hesabına girilemez.',
      'Kurulumda verilen KURTARMA KODLARINI sakla — telefonunu kaybedersen giriş yolun onlardır.',
      'Kullanıcılar (Gelişmiş → Kullanıcılar): her çalışana ayrı hesap aç, kimin ne yaptığı kayıtlarda görünür.',
    ],
  },
];

const QUICK = [
  { i: '🧾', t: 'Arıza gelince', d: 'Yeni Fiş aç, parçayı okut, teslim et' },
  { i: '🔢', t: 'Ayda bir', d: 'Sayaç Turu — tüm cihazları tek listede oku' },
  { i: '💰', t: 'Para gelince', d: 'Muhasebe’den tahsilatı gir' },
];

const CHAIN = [
  { i: '👤', t: 'Müşteri' },
  { i: '🖨️', t: 'Cihaz' },
  { i: '🧾', t: 'Servis Fişi' },
  { i: '💰', t: 'Para' },
];

export default function YardimPage() {
  const [open, setOpen] = useState<string>('');

  return (
    <div style={{ padding: '1.5rem 1.25rem 3rem', maxWidth: 820, margin: '0 auto' }}>
      <div style={{ background: 'linear-gradient(135deg,#0f2253,#2563eb)', color: 'white', borderRadius: '1rem', padding: '1.4rem 1.6rem', marginBottom: '1rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>📘 Nasıl Kullanılır?</h1>
        <p style={{ margin: '0.35rem 0 0', opacity: 0.9, fontSize: '0.92rem' }}>
          Önce aşağıdaki <b>2 dakikalık özet</b> — sistemi anlamak için yeterli. Ayrıntı gerekirse altındaki başlıkları aç.
        </p>
      </div>

      {/* ═══ 2 DAKİKADA SİSTEM (hep açık) ═══ */}
      <div style={{ background: 'white', border: '2px solid #0f2253', borderRadius: 14, padding: '1.2rem 1.3rem', marginBottom: '1.25rem' }}>
        <div style={{ fontSize: 10.5, letterSpacing: '.16em', textTransform: 'uppercase', fontWeight: 800, color: '#2563eb' }}>2 dakikada sistem</div>

        <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '.6rem 0 .5rem', color: '#0f172a' }}>Her şey tek bir zincir</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: '1.1rem' }}>
          {CHAIN.map((c, i) => (
            <div key={c.t} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f1f5f9', borderRadius: 999, padding: '.35rem .8rem' }}>
                <span>{c.i}</span>
                <span style={{ fontWeight: 700, fontSize: '.86rem', color: '#0f172a' }}>{c.t}</span>
              </div>
              {i < CHAIN.length - 1 && <span style={{ color: '#94a3b8', fontWeight: 700 }}>→</span>}
            </div>
          ))}
        </div>
        <p style={{ fontSize: '.88rem', color: '#475569', margin: '0 0 1.1rem', lineHeight: 1.6 }}>
          Müşteriyi ve cihazını bir kere kaydedersin. Sonra her serviste fiş açarsın; <b>fatura, cari hesap ve borç
          takibini sistem kendi yapar</b>.
        </p>

        <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 .6rem', color: '#0f172a' }}>Günde yaptığın 3 şey</h2>
        <div style={{ display: 'grid', gap: '.5rem', marginBottom: '1.1rem' }}>
          {QUICK.map((q) => (
            <div key={q.t} style={{ display: 'flex', gap: '.7rem', alignItems: 'center', background: '#f8fafc', borderRadius: 10, padding: '.6rem .8rem' }}>
              <span style={{ fontSize: '1.15rem' }}>{q.i}</span>
              <span style={{ fontSize: '.9rem', color: '#0f172a' }}><b>{q.t}</b> <span style={{ color: '#64748b' }}>— {q.d}</span></span>
            </div>
          ))}
        </div>

        <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 .6rem', color: '#0f172a' }}>Nerede ne var</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '.4rem', fontSize: '.85rem', color: '#334155' }}>
          {[
            ['Ana Sayfa', 'dikkat gereken her şey (duran iş, borç, sözleşme)'],
            ['Servis Fişleri', 'işler + icmal yazdırma'],
            ['Sayaç Turu', 'toplu sayaç girişi'],
            ['Muhasebe', 'cari, tahsilat, borç hatırlatma'],
            ['Stok / Barkodla Satış', 'parça ve tezgâh satışı'],
            ['Gelişmiş', 'fatura, rota, rapor, zam, kârlılık'],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', gap: 6 }}>
              <b style={{ whiteSpace: 'nowrap', color: '#0f2253' }}>{k}</b>
              <span style={{ color: '#64748b' }}>— {v}</span>
            </div>
          ))}
        </div>

        <div style={{ marginTop: '1.1rem', display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
          <Link href="/import" style={{ padding: '.55rem 1rem', background: '#0f2253', color: 'white', borderRadius: 9, fontWeight: 700, fontSize: '.86rem', textDecoration: 'none' }}>
            Excel’den verimi aktar →
          </Link>
          <Link href="/customers/new" style={{ padding: '.55rem 1rem', background: 'white', border: '1px solid #cbd5e1', color: '#334155', borderRadius: 9, fontWeight: 700, fontSize: '.86rem', textDecoration: 'none' }}>
            İlk müşteriyi ekle
          </Link>
        </div>
      </div>

      {/* ═══ AYRINTILI BÖLÜMLER (katlanır) ═══ */}
      <div style={{ fontSize: 10.5, letterSpacing: '.16em', textTransform: 'uppercase', fontWeight: 800, color: '#94a3b8', margin: '0 0 .6rem .2rem' }}>
        Ayrıntı gerekirse
      </div>
      <div style={{ display: 'grid', gap: '0.5rem' }}>
        {SECTIONS.map((s) => {
          const isOpen = open === s.id;
          return (
            <div key={s.id} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
              <button
                onClick={() => setOpen(isOpen ? '' : s.id)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '0.85rem 1.05rem', background: isOpen ? '#f8fafc' : 'white', border: 'none', cursor: 'pointer', textAlign: 'left' }}
              >
                <span style={{ fontSize: '1.15rem' }}>{s.icon}</span>
                <span style={{ flex: 1, fontWeight: 700, fontSize: '0.95rem', color: '#111827' }}>{s.title}</span>
                <span style={{ color: '#9ca3af', fontSize: '1.1rem' }}>{isOpen ? '−' : '+'}</span>
              </button>
              {isOpen && (
                <div style={{ padding: '0 1.05rem 1.05rem', borderTop: '1px solid #f3f4f6' }}>
                  {s.intro && <p style={{ color: '#374151', fontSize: '0.89rem', lineHeight: 1.55, margin: '0.8rem 0 0.5rem' }}>{s.intro}</p>}
                  <ol style={{ margin: '0.6rem 0 0', paddingLeft: '1.2rem', display: 'grid', gap: '0.45rem' }}>
                    {s.steps.map((st, i) => (
                      <li key={i} style={{ color: '#1e293b', fontSize: '0.89rem', lineHeight: 1.55 }}>{st}</li>
                    ))}
                  </ol>
                  {s.tip && (
                    <div style={{ marginTop: '0.8rem', background: '#ecfeff', border: '1px solid #a5f3fc', color: '#0e7490', borderRadius: 8, padding: '0.55rem 0.75rem', fontSize: '0.84rem', lineHeight: 1.5 }}>
                      💡 {s.tip}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem', marginTop: '1.5rem' }}>
        Takıldığın bir yer olursa bize yazabilirsin — birlikte hallederiz.
      </p>
    </div>
  );
}
