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

// "Bu mesajı işledim mi?" bilgisi BU ETİKETTE tutulur, okundu işaretinde değil.
// Neden: okundu işareti kullanılırsa, kutuyu Gmail'de açan biri (ya da "hepsini
// okundu işaretle") o mesajları köprüye görünmez yapar ve O AYIN SAYAÇLARI
// SESSİZCE KAYBOLUR — kimse fark etmez, fatura eksik çıkar. Etiketi yalnız bu
// script koyar; insan davranışı sonucu değiştiremez.
const ETIKET = 'nextus-aktarildi';

/**
 * Zamanlayıcı bunu çağırır. Ayda bir gelen sayaç için 15 dakikada bir fazlasıyla
 * yeterli — sıklığı artırmak hiçbir şey kazandırmaz.
 */
function sayaclariAktar() {
  // Yalnız SON GÜNLERİN HENÜZ AKTARILMAMIŞLARI. Ölçüt etiket: insanın
  // mesajı okuması, yıldızlaması, arşivlemesi bu taramayı etkilemez.
  const etiket = GmailApp.getUserLabelByName(ETIKET) || GmailApp.createLabel(ETIKET);
  const konular = GmailApp.search('-label:' + ETIKET + ' newer_than:7d', 0, 100);
  // Etiket KONU (thread) düzeyindedir: konudaki bir mesaj aktarılınca konu
  // etiketlenir. Aynı konuya sonradan yeni sayaç mesajı düşerse konu arama
  // sonucundan çıkar — onu etiketliKonularaGelenler() yakalar. Hangi MESAJIN
  // gittiği ise script özelliklerinde tutulur; iki kez göndermeyi bu önler.
  // Döngü DIŞINDA alınıyor: her konuda yeniden çağırmak 100 gereksiz API
  // isteği demek ve Apps Script kotası bunu sevmiyor.
  const islenmis = PropertiesService.getScriptProperties();
  let aktarilan = 0, atlanan = 0;

  for (const konu of konular) {
    for (const mesaj of konu.getMessages()) {
      const mid = mesaj.getId();
      if (islenmis.getProperty('m_' + mid)) continue;   // bu mesaj zaten gitti

      const to = mesaj.getTo() || '';

      // ── EN ÖNEMLİ SATIR ──────────────────────────────────────────────
      // Yalnız bayi kodlu adresler dışarı gider. Bu kontrol olmasaydı
      // kutudaki HER okunmamış e-posta uca POST edilirdi — kişisel yazışma
      // dahil. Kodsuz posta hiç okunmaz, işaretlenmez, dokunulmaz.
      if (!/\+[a-z0-9]{4,32}@/i.test(to)) { atlanan++; continue; }

      try {
        // ── EK DOSYALAR ────────────────────────────────────────────────
        // Filo yazılımları (Kyocera Fleet Services, Lexmark Fleet Manager…)
        // sayaç raporunu gövdede DEĞİL ek dosyada gönderiyor; KFS varsayılan
        // olarak ZIP'li CSV atıyor. Ekler gönderilmezse o raporlar sessizce
        // sıfır okuma üretir. Uç yalnız metne çevrilebilenleri işler.
        const ekler = [];
        try {
          const dosyalar = mesaj.getAttachments({ includeInlineImages: false }) || [];
          for (const d of dosyalar) {
            const ad = d.getName() || '';
            // Yalnız işe yarayabilecek türler taşınır; görsel/PDF boşuna
            // ağ trafiği ve uçta nasılsa atlanıyor.
            if (!/\.(zip|csv|txt|xml|tsv|htm|html|json)$/i.test(ad)) continue;
            if (d.getSize() > 8 * 1024 * 1024) continue;   // 8 MB üstünü taşıma
            ekler.push({ ad: ad, base64: Utilities.base64Encode(d.getBytes()) });
            if (ekler.length >= 10) break;
          }
        } catch (e) {
          console.error('ek okunamadi: ' + e);
        }

        const cevap = UrlFetchApp.fetch(UC, {
          method: 'post',
          contentType: 'application/json',
          headers: { 'x-sayac-secret': SIR },
          payload: JSON.stringify({
            to: to,
            from: mesaj.getFrom(),
            subject: mesaj.getSubject(),
            text: mesaj.getPlainBody(),
            attachments: ekler,
          }),
          muteHttpExceptions: true,
        });

        const kod = cevap.getResponseCode();
        if (kod >= 200 && kod < 300) {
          // İşaretleme SADECE uç kabul edince. Uç geçici olarak düşerse hiçbir
          // işaret konmaz ve mesaj sonraki turda tekrar denenir.
          islenmis.setProperty('m_' + mid, '1');
          konu.addLabel(etiket);
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
 * Etiketli konulara sonradan düşen YENİ mesajları da yakalar.
 * (Aynı cihaz her ay aynı konu başlığıyla yazarsa Gmail bunları tek konuda
 * toplar; konu zaten etiketli olduğu için ana tarama onu görmez.)
 * Ana fonksiyondan hemen sonra çalışır, aynı 15 dakikalık tetikleyicide.
 */
function etiketliKonularaGelenler() {
  const konular = GmailApp.search('label:' + ETIKET + ' newer_than:7d', 0, 50);
  const islenmis = PropertiesService.getScriptProperties();
  let ek = 0;

  for (const konu of konular) {
    for (const mesaj of konu.getMessages()) {
      const mid = mesaj.getId();
      if (islenmis.getProperty('m_' + mid)) continue;
      const to = mesaj.getTo() || '';
      if (!/\+[a-z0-9]{4,32}@/i.test(to)) continue;

      try {
        const cevap = UrlFetchApp.fetch(UC, {
          method: 'post',
          contentType: 'application/json',
          headers: { 'x-sayac-secret': SIR },
          payload: JSON.stringify({
            to: to, from: mesaj.getFrom(), subject: mesaj.getSubject(),
            text: mesaj.getPlainBody(), attachments: [],
          }),
          muteHttpExceptions: true,
        });
        const kod = cevap.getResponseCode();
        if (kod >= 200 && kod < 300) { islenmis.setProperty('m_' + mid, '1'); ek++; }
        else console.error('uc reddetti (' + kod + ')');
      } catch (e) { console.error('gonderilemedi: ' + e); }
    }
  }
  if (ek) console.log('etiketli konulardan ek aktarim: ' + ek);
}

/**
 * 7 günden eski işlendi kayıtlarını temizler — script özellikleri 500 KB ile
 * sınırlı, sonsuza kadar birikirse kota dolar ve köprü durur.
 * Ayda bir çalışması yeter; tetikleyiciKur() bunu da kurar.
 */
function eskiKayitlariTemizle() {
  const islenmis = PropertiesService.getScriptProperties();
  const hepsi = islenmis.getProperties();
  const anahtarlar = Object.keys(hepsi).filter(function (k) { return k.indexOf('m_') === 0; });
  // 2000'den fazlaysa en eskileri at (Gmail zaten newer_than:7d ile sınırlı,
  // 7 günden eski bir mesaj tekrar taranmaz — kaydı tutmanın anlamı yok).
  if (anahtarlar.length <= 2000) { console.log('temizlik gerekmedi: ' + anahtarlar.length); return; }
  for (let i = 0; i < anahtarlar.length - 1000; i++) islenmis.deleteProperty(anahtarlar[i]);
  console.log('temizlendi, kalan: 1000');
}

/**
 * Kurulumu bir kez çalıştır: 15 dakikada bir tetikleyici kurar.
 * İki kez çalıştırırsan eskisini siler, tetikleyici çoğalmaz.
 */
function tetikleyiciKur() {
  const bizim = ['sayaclariAktar', 'etiketliKonularaGelenler', 'eskiKayitlariTemizle'];
  for (const t of ScriptApp.getProjectTriggers()) {
    if (bizim.indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t);
  }
  ScriptApp.newTrigger('sayaclariAktar').timeBased().everyMinutes(15).create();
  ScriptApp.newTrigger('etiketliKonularaGelenler').timeBased().everyHours(1).create();
  ScriptApp.newTrigger('eskiKayitlariTemizle').timeBased().everyDays(1).atHour(4).create();
  console.log('tetikleyiciler kuruldu: aktarim 15 dk, etiketli konular 1 sa, temizlik gunluk');
}
