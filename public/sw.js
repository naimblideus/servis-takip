/**
 * NEXTUS SERVİS — SERVICE WORKER
 *
 * ── NEDEN VAR ────────────────────────────────────────────────────────────
 * Teknisyen sahada. Müşterinin bodrum katındaki fotokopi odasında sinyal
 * yok. Uygulama açılmazsa sayaç turu yapılamaz, fiş görülemez. Service
 * worker olmadan o an ekranda Chrome'un dinozoru çıkıyordu.
 *
 * ── EN ÖNEMLİ KURAL: /api/ ASLA ÖNBELLEĞE ALINMAZ ────────────────────────
 * Bu uygulama para tutuyor: borç, tahsilat, sayaç, fatura. Eski bir cevabı
 * önbellekten vermek "müşteri borcu ₺0" göstermek demektir. Bir bayinin
 * yanlış tahsilat kararı vermesindense ekranın hiç açılmaması iyidir.
 * API istekleri her zaman ağdan gider; ağ yoksa hata döner, uygulama
 * kendi hata durumunu gösterir.
 *
 * ── HTML NEDEN ÖNCE AĞDAN ────────────────────────────────────────────────
 * Bu depo günde birkaç kez canlıya çıkıyor. Sayfayı önbellekten vermek,
 * bayinin dünkü sürümü görmesi demek. Sayfa her zaman ağdan istenir;
 * yalnız ağ yoksa çevrimdışı sayfası gösterilir.
 *
 * ── STATİK DOSYALAR NEDEN ÖNBELLEKTEN ────────────────────────────────────
 * /_next/static altındaki dosyaların adında içerik özeti var; içerik
 * değişince ad değişir. Bu yüzden eskimeleri mümkün değil, önbellekten
 * vermek güvenli ve açılışı belirgin hızlandırıyor.
 */

// Sürüm: her değişiklikte artır — eski önbellek activate'te silinir.
const SURUM = 'nextus-v1';
const KABUK = `${SURUM}-kabuk`;
const STATIK = `${SURUM}-statik`;
const CEVRIMDISI = '/cevrimdisi.html';

// Kurulumda yalnız çevrimdışı sayfası ve ikonlar. Uygulama kabuğunu
// önceden çekmiyoruz: Next.js parçalarının adı her dağıtımda değişir,
// listeyi elle tutmak eskimeye davetiye çıkarır.
const ONCEDEN = [CEVRIMDISI, '/icon-192.png', '/icon-512.png', '/manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(KABUK)
      .then((c) => c.addAll(ONCEDEN))
      // Tek bir dosya bulunamazsa kurulum tamamen düşmesin.
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((adlar) => Promise.all(
        adlar.filter((a) => !a.startsWith(SURUM)).map((a) => caches.delete(a)),
      ))
      .then(() => self.clients.claim()),
  );
});

// Sayfa "hemen güncelle" diyebilsin (yeni sürüm bildirimi için).
self.addEventListener('message', (e) => {
  if (e.data === 'HEMEN_GUNCELLE') self.skipWaiting();
});

const statikMi = (u) =>
  u.pathname.startsWith('/_next/static/') ||
  u.pathname.startsWith('/fonts/') ||
  /\.(?:png|jpg|jpeg|svg|webp|ico|woff2?|css)$/i.test(u.pathname);

self.addEventListener('fetch', (e) => {
  const istek = e.request;
  if (istek.method !== 'GET') return;                 // yazma işlemleri hep ağdan

  let u;
  try { u = new URL(istek.url); } catch { return; }
  if (u.origin !== self.location.origin) return;      // dış kaynaklara karışma

  // ── PARA VERİSİ: asla önbellek ────────────────────────────────────────
  if (u.pathname.startsWith('/api/')) return;

  // ── Müşteri paneli ve belgeler: kişiye özel, önbelleğe alınmaz ────────
  if (u.pathname.startsWith('/m/') || u.pathname.startsWith('/belge/')) return;

  // ── Statik: önbellekten ver, arkada tazele ────────────────────────────
  if (statikMi(u)) {
    e.respondWith(
      caches.match(istek).then((vurus) => {
        const agdan = fetch(istek).then((y) => {
          if (y && y.ok) caches.open(STATIK).then((c) => c.put(istek, y.clone()));
          return y;
        }).catch(() => vurus);
        return vurus || agdan;
      }),
    );
    return;
  }

  // ── Sayfa gezinmesi: ÖNCE AĞ, ağ yoksa çevrimdışı sayfası ─────────────
  if (istek.mode === 'navigate') {
    e.respondWith(
      fetch(istek).catch(() =>
        caches.match(CEVRIMDISI).then((y) => y || new Response(
          '<h1>Bağlantı yok</h1>', { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
        )),
      ),
    );
  }
});
