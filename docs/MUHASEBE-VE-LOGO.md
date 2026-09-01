# Muhasebe, cari ve Logo — sistem ne yapar, ne yapmaz

Bu belge iki soruya cevap verir:
1. Sistemdeki "cari" tam olarak nedir, para nereden nereye akar?
2. **Logo kullanan bir bayi bunu nasıl kullanır?** (En sık gelen soru.)

---

## 1. Önce en önemli cümle: Nextus Servis muhasebe programı DEĞİL

Bu ayrım netleşmezse hem satış hem kurulum yanlış gider.

| | Logo | Nextus Servis |
|---|---|---|
| Yasal defter, KDV beyanı, mizan | ✅ | ❌ hiç yok |
| e-Fatura / e-Arşiv kesme | ✅ | ❌ hiç yok |
| Bilanço, gelir tablosu | ✅ | ❌ hiç yok |
| Hangi makine hangi müşteride | ❌ | ✅ |
| Sayacı okumak, tıklama bedelini hesaplamak | ❌ | ✅ |
| Teknisyen nereye gitti, ne taktı | ❌ | ✅ |
| Kira + sayaç + parça + işçiliği tek icmalde toplamak | ❌ | ✅ |

**Nextus Servis, Logo'nun yerine geçmez — Logo'ya ne yazacağını söyler.**

Logo "bu müşteriye 12.400 TL fatura kes" dendiğinde keser. O 12.400'ün nereden
geldiğini (hangi makine, kaç sayfa, hangi tarife, hangi parça) hesaplayan
tarafta hiçbir muhasebe programı yoktur. Bayi bunu bugün Excel'de yapıyor.

Satış cümlesi de buradan çıkar:

> "Logo'nuz kalsın, hiçbir yere gitmiyor. Biz Logo'nun bilmediği tarafı
> yapıyoruz: sayacı okuyup ay sonu tutarı çıkarıyoruz. Siz o tutarı Logo'da
> faturalıyorsunuz — ya da biz Logo'ya kendimiz yazıyoruz."

---

## 2. Cari nedir — sistemdeki hâliyle

Sistemdeki cari, **müşteri başına iki sütunlu bir defterdir**. Muhasebedeki
çift taraflı kayıt değil; bilerek basit (`AccountEntry` tablosu).

| Tür | Anlamı | Bakiyeye etkisi |
|---|---|---|
| `SALE` | Müşteri borçlandı | + |
| `PAYMENT` | Müşteri ödedi | − |

**Bakiye = toplam SALE − toplam PAYMENT.** Bir müşterinin "bize ne kadar
borcu var" sorusunun cevabı budur, başka hesap yoktur.

Her kayıtta ayrıca şunlar durur: ödeme yöntemi (Nakit / Kredi / IBAN / Açık
Hesap), kaydı yapan kişi (teknisyen adı dahil), tarih ve — servis fişinden
geldiyse — **fiş kimliği**.

O fiş kimliği önemli: aynı fiş iki kez cariye yazılamaz. Mükerrer borç
yapısal olarak engellenmiştir, dikkatle değil.

---

## 3. Para nereden geliyor — üç kaynak

### a) Servis fişi
Teknisyen işi bitirir, parça + işçilik tutarı çıkar. Fiş ödendi olarak
kapanınca cariye `SALE` düşer. Fişin kimliği kayda yazıldığı için ikinci kez
düşmez.

### b) Aylık kira + sayaç
Ayın sonunda kiralık cihazların kirası ve sayaç aşımı hesaplanır.

**Bu OTOMATİK yazılmaz — bayi düğmeye basar.** Bilerek böyle: sistem kendi
kendine cariye borç yazsaydı bayi kontrolü kaybederdi, "bu rakam nereden
çıktı" sorusu doğardı.

Sayaç bedeli, e-postayla gelen ya da elle girilen okumalardan hesaplanır.
Hesap, faturalamayla **aynı kaynaktan** yapılır — iki ayrı yerde iki ayrı
formül yoktur, olsaydı iki farklı rakam çıkardı.

### c) Elle giriş
Bayi doğrudan bir satış ya da tahsilat yazabilir (toner satışı, avans vb.).

---

## 4. Fatura (icmal) ile cari farkı

**Cari** = akan hesap, "şu an ne borçlu".
**Fatura** (`CustomerInvoice`) = belli bir dönemin resmî dökümü: kira satırı,
sayaç satırı, parça satırları, işçilik — hepsi kalem kalem.

Faturanın en kritik özelliği **çift saymama**:

- Cariye zaten yazılmış servis fişleri aylık faturaya **girmez**
- Faturalanan sayaç okumaları işaretlenir, ikinci kez faturalanamaz
- Cihazın son faturalandığı dönem tutulur

Bu üç bayrak olmasa aynı iş hem fişten hem aylık icmalden faturalanırdı —
müşteri iki kez öderdi ve bunu fark eden ilk kişi müşteri olurdu.

**Gelir ne zaman yazılır:** fatura kesildiğinde değil, **tahsilat yapıldığında**.
Yani ciro rakamı "kesilen fatura" değil "tahsil edilen para". Bu bilinçli bir
tercih — kesilip tahsil edilmemiş fatura ciro sayılırsa bayi kendini olduğundan
zengin görür.

---

## 5. Logo kullanan bayi bunu nasıl kullanır

Üç kurulum var. **Bugün yalnız biri gerçekten çalışıyor** — dürüst olmak
gerekirse aşağıda hepsi işaretli.

### A) Logo hiç bağlanmadan (en yaygın, bugün önerilen)

1. Ay sonu bayi "Bu Dönemi Faturala" der
2. Sistem icmali çıkarır: müşteri başına kira + sayaç + parça + işçilik
3. Bayi o tutarları Logo'ya girer ve e-faturayı Logo'dan keser

**Kazanç:** tutarı hesaplama işi bitiyor. Bugün o iş Excel'de yapılıyor ve
ayda 2-3 makinenin sayacı hiç gelmediği için o makinelerden para kazanılmıyor.

Bu kurulumda hiçbir teknik iş yok. Bayi bugün ne yapıyorsa aynısını yapmaya
devam ediyor, sadece rakamlar hazır geliyor.

### B) Logo REST API ile otomatik aktarım ✅ *çalışıyor*

Bayinin Logo'sunda REST servisi açıksa sistem cariyi, faturayı ve tahsilatı
doğrudan Logo'ya yazar. Ayarlarda API adresi, anahtar, firma ve dönem kodu
girilir.

Bu kurulumda ay sonu tek düğme: hesapla → Logo'ya yaz.

### C) XML dosya ya da MSSQL bağlantısı ❌ *henüz yok*

Ayarlarda bu seçenekler görünüyor ama **uygulanmadı**. Seçilirse sistem
açıkça "bu yöntem henüz uygulanmadı, REST kullanın" der ve aktarım yapmaz.

Eskiden sessizce "başarılı" diyordu — bayi "100 fatura aktarıldı" görüp
Logo'ya bakınca hiçbir şey bulamıyordu. Bu düzeltildi
(`scripts/test-logo-durustluk.mjs` bunun geri gelmediğini denetler).

**Satarken bunu söyle:** "Logo entegrasyonu REST API ile çalışıyor. Logo'nuzda
REST açık değilse aylık icmali size veriyoruz, Logo'ya siz giriyorsunuz."

Yapamadığın bir şeyi vaat etmemek, ilk ay ortaya çıkacak bir yalandan
sonsuz kez daha ucuz.

---

## 6. Bayiye anlatırken kullanılacak sıra

Sıra önemli — avatardaki adamın umursadığı sıra bu:

1. **"Sayacı biz okuyoruz."** Cihaz maili atıyor, sisteme kendi düşüyor.
   Gelmeyeni de görüyorsunuz — bugün gelmeyen makineden para kazanılmıyor.
2. **"Ay sonu tek düğme."** Kira + sayaç + parça + işçilik tek icmalde.
   Kızınızla gece 9'a kadar Excel yok.
3. **"Tartışma bitiyor."** Müşteri "o kadar çekmedim" dediğinde elinizde
   tarihli sayaç kaydı var.
4. **"Logo'nuz kalıyor."** Yerine geçmiyoruz, besliyoruz.

Ürün adından, yapay zekâdan, dijitalleşmeden bahseden cümle bu adamı kaybeder.

---

## 7. Sistemin muhasebe tarafında YAPMADIĞI şeyler

Bunları bilerek yapmıyoruz; sorulursa net cevap ver:

- KDV hesaplama ve beyan
- e-Fatura / e-Arşiv kesme (Logo'nun işi)
- Çift taraflı muhasebe kaydı, mizan, bilanço
- Banka entegrasyonu, otomatik mutabakat
- Çek/senet takibi

Bunları isteyen bayi zaten muhasebe programı arıyordur, bizi değil.
