/**
 * Gmail → Nextus Servis sayaç ucu aktarıcı (Google Apps Script)
 *
 * Kendi alan adı alınana kadar geçici köprü. Gmail artı-adreslemeyi destekler:
 * hesabin+abcd1234@gmail.com adresine gelen posta senin kutuna düşer ve
 * "To" başlığında kod korunur — yani bayi kodu şeması aynen çalışır.
 *
 * Alan adı alındığında bu script silinir, yerine Cloudflare Email Routing
 * catch-all Worker'ı gelir. Uygulama tarafında hiçbir değişiklik gerekmez;
 * uç kaynağı umursamıyor, yalnız "to" alanının gelmesini bekliyor.
 *
 * KURULUM: docs/SAYAC-EPOSTA-KURULUM.md
 */

// ── Doldurulacak iki değer ───────────────────────────────────────────────
const UC = 'https://UYGULAMA-ADRESIN/api/sayac/eposta';
const SIR = 'BURAYA-SIR';

/**
 * Zamanlayıcı bunu çağırır. Ayda bir gelen sayaç için 15 dakikada bir fazlasıyla
 * yeterli — sıklığı artırmak hiçbir şey kazandırmaz.
 */
function sayaclariAktar() {
  // Yalnız SON GÜNLERİN okunmamışları: eski kutuyu her seferinde taramayalım.
  const konular = GmailApp.search('is:unread newer_than:7d', 0, 100);
  let aktarilan = 0, atlanan = 0;

  for (const konu of konular) {
    for (const mesaj of konu.getMessages()) {
      if (!mesaj.isUnread()) continue;

      const to = mesaj.getTo() || '';

      // ── EN ÖNEMLİ SATIR ──────────────────────────────────────────────
      // Yalnız bayi kodlu adresler dışarı gider. Bu kontrol olmasaydı
      // kutudaki HER okunmamış e-posta uca POST edilirdi — kişisel yazışma
      // dahil. Kodsuz posta hiç okunmaz, işaretlenmez, dokunulmaz.
      if (!/\+[a-z0-9]{4,32}@/i.test(to)) { atlanan++; continue; }

      try {
        const cevap = UrlFetchApp.fetch(UC, {
          method: 'post',
          contentType: 'application/json',
          headers: { 'x-sayac-secret': SIR },
          payload: JSON.stringify({
            to: to,
            from: mesaj.getFrom(),
            subject: mesaj.getSubject(),
            text: mesaj.getPlainBody(),
          }),
          muteHttpExceptions: true,
        });

        const kod = cevap.getResponseCode();
        if (kod >= 200 && kod < 300) {
          // Okundu işareti SADECE uç kabul edince. Uç geçici olarak
          // düşerse mesaj okunmamış kalır ve sonraki turda tekrar denenir.
          mesaj.markRead();
          aktarilan++;
          console.log('aktarildi: ' + to + ' → ' + cevap.getContentText().slice(0, 200));
        } else {
          // 401 = sır uyuşmuyor · 503 = Coolify'da sır tanımlı değil
          console.error('uc reddetti (' + kod + '): ' + cevap.getContentText().slice(0, 200));
        }
      } catch (e) {
        console.error('gonderilemedi: ' + e);
      }
    }
  }

  console.log('bitti — aktarilan: ' + aktarilan + ', bize ait olmayan: ' + atlanan);
}

/**
 * Kurulumu bir kez çalıştır: 15 dakikada bir tetikleyici kurar.
 * İki kez çalıştırırsan eskisini siler, tetikleyici çoğalmaz.
 */
function tetikleyiciKur() {
  for (const t of ScriptApp.getProjectTriggers()) {
    if (t.getHandlerFunction() === 'sayaclariAktar') ScriptApp.deleteTrigger(t);
  }
  ScriptApp.newTrigger('sayaclariAktar').timeBased().everyMinutes(15).create();
  console.log('tetikleyici kuruldu: 15 dakikada bir');
}
