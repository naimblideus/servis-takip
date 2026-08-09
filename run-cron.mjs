// Zamanlanmış görev çalıştırıcı — Coolify "Scheduled Tasks" (veya crontab) tarafından çağrılır.
//
// NEDEN VAR: vercel.json'daki cron tanımları YALNIZ Vercel'de çalışır. Bu uygulama Coolify/Docker'da
// koştuğu için o tanımlar hiç tetiklenmiyordu (aylık faturalama + vadesi-geçen işaretleme sessizce ölüydü).
//
// KULLANIM (container içinde):
//   node run-cron.mjs faturalar      -> aylık müşteri faturalarını üret   (ayın 1'i)
//   node run-cron.mjs hatirlatma     -> vadesi geçenleri işaretle + kuyruğa al (her gün)
//
// Uygulamanın KENDİ portuna (127.0.0.1) gider: dışarı çıkmaz, TLS/domain sorunu olmaz.
// CRON_SECRET zorunlu (uçlar fail-closed). Hata varsa exit 1 -> Coolify görevi "başarısız" gösterir.

const JOBS = {
  faturalar: { path: '/api/cron/generate-customer-invoices', label: 'Aylık müşteri faturaları' },
  hatirlatma: { path: '/api/cron/overdue-reminders', label: 'Vadesi geçen kontrolü' },
  // Ayın başında çalıştırılır: sayacı okunmamış kiralık cihazların müşterilerine
  // WhatsApp'tan "sayaç fotoğrafı" hatırlatması gider. Faturalama döngüsünü besler.
  sayac: { path: '/api/cron/sayac-hatirlatma', label: 'Aylık sayaç hatırlatma' },
  // WhatsApp mesaj saklama süresi. VARSAYILAN KAPALI: yalnızca WHATSAPP_SAKLAMA_GUN
  // tanımlıysa siler, aksi halde hiçbir şeye dokunmaz. Kurmak zorunda değilsin.
  'wa-temizlik': { path: '/api/cron/whatsapp-temizlik', label: 'WhatsApp mesaj temizliği (kapalıysa no-op)' },
  // Sessiz arıza taraması: cron durmuş mu, webhook susmuş mu, kuyruk birikmiş mi.
  // KRİTİK bulguda uç 500 döner -> bu betik exit 1 -> Coolify görevi kırmızı olur.
  nobetci: { path: '/api/cron/nobetci', label: 'Nöbetçi (sessiz arıza taraması)' },
};
// Takma adlar
JOBS.invoices = JOBS.faturalar;
JOBS.overdue = JOBS.hatirlatma;
JOBS.counters = JOBS.sayac;

const name = (process.argv[2] || '').toLowerCase();
const job = JOBS[name];
const stamp = () => new Date().toISOString();

if (!job) {
  console.error(`[cron ${stamp()}] Geçersiz görev: "${name}". Kullanılabilir: ${Object.keys(JOBS).join(' | ')}`);
  process.exit(1);
}

const secret = process.env.CRON_SECRET;
if (!secret) {
  console.error(`[cron ${stamp()}] CRON_SECRET tanımlı değil — uçlar fail-closed, görev çalıştırılamaz.`);
  process.exit(1);
}

const port = process.env.PORT || 3000;
const url = `http://127.0.0.1:${port}${job.path}`;

// Faturalama büyük bayilerde uzun sürebilir (uçta maxDuration 300sn) — bol pay bırak.
const TIMEOUT_MS = 10 * 60 * 1000;

console.log(`[cron ${stamp()}] BAŞLADI · ${job.label} (${name}) -> ${job.path}`);

try {
  const res = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const text = await res.text();

  if (!res.ok) {
    // Nöbetçi kritik bulguda bilerek 500 döner — sebebi okunur yaz, ham JSON değil.
    let detay = text.slice(0, 400);
    try {
      const d = JSON.parse(text);
      if (d.ozet) detay = `${d.ozet} · ` + (d.kontroller || [])
        .filter((k) => k.seviye !== 'iyi').map((k) => `${k.ad}: ${k.mesaj}`).join(' | ');
    } catch { /* JSON değilse ham metni bırak */ }
    console.error(`[cron ${stamp()}] BAŞARISIZ · HTTP ${res.status} · ${detay}`);
    process.exit(1);
  }

  // Özet logla (Coolify görev geçmişinde okunabilir olsun)
  let summary = text.slice(0, 400);
  try {
    const d = JSON.parse(text);
    if (name === 'faturalar' || name === 'invoices') {
      summary = `dönem=${d.period} · ${d.tenants} bayi işlendi`;
    } else if (name === 'sayac' || name === 'counters') {
      summary = d.skipped
        ? `atlandı · ${d.skipped}`
        : `dönem=${d.period} · ${(d.results || []).reduce((a, r) => a + r.sent, 0)} hatırlatma gönderildi`;
    } else if (name === 'nobetci') {
      summary = `${d.ozet} · alarm=${d.alarm}`;
    } else if (name === 'wa-temizlik') {
      summary = text.slice(0, 200);
    } else {
      summary = `${d.overdueCount} fatura OVERDUE işaretlendi · ${d.queued} hatırlatma kuyruğa alındı`;
    }
  } catch { /* JSON değilse ham metni bırak */ }

  console.log(`[cron ${stamp()}] TAMAM · ${summary}`);
  process.exit(0);
} catch (e) {
  const msg = e?.name === 'TimeoutError' ? `zaman aşımı (${TIMEOUT_MS / 1000}sn)` : (e?.message || String(e));
  console.error(`[cron ${stamp()}] HATA · ${msg}`);
  process.exit(1);
}
