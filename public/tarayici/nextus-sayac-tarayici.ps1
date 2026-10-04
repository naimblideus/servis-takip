<#
  NEXTUS SERVİS — SAYAÇ TARAYICI

  NE YAPAR
    Bu bilgisayarın bağlı olduğu yerel ağdaki yazıcı ve fotokopi
    makinelerini bulur, her birinin seri numarasını, modelini ve sayacını
    cihazın kendisinden okur (SNMP), sonucu Nextus Servis panelinize
    gönderir. Bir-iki dakika sürer.

  NE YAPMAZ
    · Cihazlarda HİÇBİR ayarı değiştirmez; yalnız okur (SNMP GET).
    · Bu bilgisayara hiçbir şey kurmaz (-GunlukKur seçilmedikçe).
    · Ağdaki dosyalara, belgelere, baskı içeriklerine dokunmaz.
    · Gönderdiği tek şey: cihazların IP adresi, marka/model, seri numarası,
      sayaç, toner seviyesi ve cihazın kendi bildirdiği durum (kâğıt
      sıkışması, servis uyarısı gibi).

  ÜCRETSİZ KİP
    Dosya panelden değil sitedeki genel bağlantıdan indirildiyse (anahtar
    yok) sonuç HİÇBİR YERE GÖNDERİLMEZ: aynı tarama yapılır, bu bilgisayarın
    masaüstünde bir rapor (tarayıcıda açılan sayfa + Excel için CSV) açılır.

  NASIL ÇALIŞTIRILIR
    Dosyaya sağ tıklayın > "PowerShell ile çalıştır".
    Soru gelirse "Bir kez çalıştır" (R) deyin.

  SEÇENEKLER
    -Hedef 192.168.1.0/24   yalnız bu ağı tara (virgülle birden çok)
    -Topluluk public        SNMP topluluk adı (cihazda değiştirildiyse)
    -Kuru                   hiçbir şey göndermeden sonucu ekrana yaz
    -GunlukKur              her gün 09:00'da kendiliğinden çalışsın
    -Sessiz                 pencere beklemesin (zamanlanmış çalışma için)
    -RaporKlasoru C:\yol    ücretsiz kipte raporun yazılacağı klasör
#>
param(
  [string]$Sunucu = '__SUNUCU__',
  [string]$Anahtar = '__ANAHTAR__',
  [string]$Dil = '__DIL__',
  [string[]]$Hedef = @(),
  [int]$Port = 161,
  [string]$Topluluk = 'public',
  [int]$ZamanAsimi = 1500,
  [string]$RaporKlasoru = '',
  [switch]$Kuru,
  [switch]$Sessiz,
  [switch]$GunlukKur
)

$ErrorActionPreference = 'Stop'
# Çıktı UTF-8: yönlendirilen ya da eski kod sayfalı konsolda Türkçe harfler
# bozuluyordu. Konsol izin vermezse (bazı uzak oturumlar) sessizce geçilir.
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch { }
$SURUM = 3

# ÜCRETSİZ KİP: dosya panelden değil sitedeki genel bağlantıdan indirildi
# (anahtar yok). Tarama aynıdır; sonuç hiçbir yere gönderilmez, bu
# bilgisayarda rapor olarak açılır. Teknik servis hesap açmadan kendi
# makinelerini görür.
$Ucretsiz = ($Anahtar -like '__*' -or [string]::IsNullOrWhiteSpace($Anahtar))
if ($Dil -like '__*') { if ((Get-Culture).Name -like 'tr*') { $Dil = 'tr' } else { $Dil = 'en' } }
$SiteAdresi = $Sunucu
if ($SiteAdresi -like '__*' -or -not $SiteAdresi) { $SiteAdresi = 'https://nextusservis.com' }

$TR = ($Dil -ne 'en')
# PowerShell'de değişken adı büyük/küçük harf ayırmaz: parametre $tr olsaydı
# içerideki $TR o parametre olurdu ve İngilizce kipte de hep Türkçe yazılırdı.
function Yaz([string]$metinTr, [string]$metinEn) { if ($TR) { Write-Host $metinTr } else { Write-Host $metinEn } }

# ── BER (SNMP'nin kodlaması) ──────────────────────────────────────────────

function Ber-Uzunluk([int]$n) {
  if ($n -lt 0x80) { return ,([byte[]]@([byte]$n)) }
  $b = New-Object System.Collections.Generic.List[byte]
  $x = $n
  while ($x -gt 0) { $b.Insert(0, [byte]($x -band 0xFF)); $x = $x -shr 8 }
  $b.Insert(0, [byte](0x80 -bor $b.Count))
  return ,($b.ToArray())
}

function Ber-Tlv([byte]$tag, [byte[]]$deger) {
  $l = New-Object System.Collections.Generic.List[byte]
  $l.Add($tag)
  $l.AddRange([byte[]](Ber-Uzunluk $deger.Length))
  if ($deger.Length) { $l.AddRange($deger) }
  return ,($l.ToArray())
}

function Ber-Tamsayi([long]$n) {
  $b = [BitConverter]::GetBytes($n)
  [Array]::Reverse($b)
  $i = 0
  while ($i -lt 7 -and ((($b[$i] -eq 0) -and (($b[$i + 1] -band 0x80) -eq 0)) -or (($b[$i] -eq 0xFF) -and (($b[$i + 1] -band 0x80) -ne 0)))) { $i++ }
  return Ber-Tlv 0x02 ([byte[]]$b[$i..7])
}

function Ber-Oid([string]$oid) {
  $p = @($oid.Split('.') | ForEach-Object { [uint64]$_ })
  $govde = New-Object System.Collections.Generic.List[byte]
  $govde.Add([byte](40 * $p[0] + $p[1]))
  for ($i = 2; $i -lt $p.Count; $i++) {
    $v = [uint64]$p[$i]
    $parca = New-Object System.Collections.Generic.List[byte]
    $parca.Insert(0, [byte]($v -band 0x7F))
    $v = $v -shr 7
    while ($v -gt 0) { $parca.Insert(0, [byte](0x80 -bor ($v -band 0x7F))); $v = $v -shr 7 }
    $govde.AddRange($parca)
  }
  return Ber-Tlv 0x06 ($govde.ToArray())
}

function Snmp-Istek([int]$istekNo, [byte]$pduTur, [string[]]$oidler) {
  $vb = New-Object System.Collections.Generic.List[byte]
  foreach ($o in $oidler) {
    $ic = New-Object System.Collections.Generic.List[byte]
    $ic.AddRange([byte[]](Ber-Oid $o))
    $ic.AddRange([byte[]]@(0x05, 0x00))
    $vb.AddRange([byte[]](Ber-Tlv 0x30 ($ic.ToArray())))
  }
  $pdu = New-Object System.Collections.Generic.List[byte]
  $pdu.AddRange([byte[]](Ber-Tamsayi $istekNo))
  $pdu.AddRange([byte[]](Ber-Tamsayi 0))
  $pdu.AddRange([byte[]](Ber-Tamsayi 0))
  $pdu.AddRange([byte[]](Ber-Tlv 0x30 ($vb.ToArray())))
  $m = New-Object System.Collections.Generic.List[byte]
  $m.AddRange([byte[]](Ber-Tamsayi 1))   # SNMPv2c
  $m.AddRange([byte[]](Ber-Tlv 0x04 ([Text.Encoding]::ASCII.GetBytes($Topluluk))))
  $m.AddRange([byte[]](Ber-Tlv $pduTur ($pdu.ToArray())))
  return Ber-Tlv 0x30 ($m.ToArray())
}

function Ber-Oku([byte[]]$b, [int]$i) {
  if ($i + 1 -ge $b.Length) { return $null }
  $tag = $b[$i]; $i++
  $u = [int]$b[$i]; $i++
  if ($u -band 0x80) {
    $k = $u -band 0x7F; $u = 0
    for ($j = 0; $j -lt $k; $j++) { $u = ($u -shl 8) -bor $b[$i]; $i++ }
  }
  if ($i + $u -gt $b.Length) { return $null }
  if ($u -gt 0) { $d = [byte[]]$b[$i..($i + $u - 1)] } else { $d = [byte[]]@() }
  return @{ Tag = [int]$tag; Deger = $d; Son = $i + $u }
}

function Ber-Cocuklar([byte[]]$d) {
  $liste = New-Object System.Collections.ArrayList
  $i = 0
  while ($i -lt $d.Length) {
    $t = Ber-Oku $d $i
    if (-not $t) { break }
    [void]$liste.Add($t); $i = $t.Son
  }
  return ,$liste
}

function Ber-Sayi([byte[]]$d, [bool]$isaretli) {
  if ($d.Length -eq 0) { return [long]0 }
  [decimal]$v = 0
  foreach ($x in $d) { $v = $v * 256 + $x }
  if ($isaretli -and ($d[0] -band 0x80)) { $v = $v - [decimal][math]::Pow(2, 8 * $d.Length) }
  if ($v -gt [long]::MaxValue) { return $null }
  return [long]$v
}

function Oid-Coz([byte[]]$d) {
  if ($d.Length -eq 0) { return '' }
  $ilk = [int]$d[0]
  if ($ilk -ge 80) { $arc = @(2, ($ilk - 80)) } elseif ($ilk -ge 40) { $arc = @(1, ($ilk - 40)) } else { $arc = @(0, $ilk) }
  $parca = New-Object System.Collections.ArrayList
  [void]$parca.AddRange($arc)
  [uint64]$v = 0
  for ($i = 1; $i -lt $d.Length; $i++) {
    $v = ($v -shl 7) -bor [uint64]($d[$i] -band 0x7F)
    if (($d[$i] -band 0x80) -eq 0) { [void]$parca.Add($v); $v = 0 }
  }
  return ($parca -join '.')
}

function Ber-Metin([byte[]]$d) {
  if ($d.Length -eq 0) { return '' }
  $s = [Text.Encoding]::UTF8.GetString($d) -replace '[\x00-\x1F\x7F]', ''
  return $s.Trim()
}

function Ber-Deger($t) {
  switch ($t.Tag) {
    0x02 { return Ber-Sayi $t.Deger $true }
    0x41 { return Ber-Sayi $t.Deger $false }
    0x42 { return Ber-Sayi $t.Deger $false }
    0x43 { return Ber-Sayi $t.Deger $false }
    0x46 { return Ber-Sayi $t.Deger $false }
    0x04 { return Ber-Metin $t.Deger }
    0x06 { return Oid-Coz $t.Deger }
    default { return $null }   # NULL, noSuchObject, noSuchInstance, endOfMibView
  }
}

function Snmp-Coz([byte[]]$paket) {
  $kok = Ber-Oku $paket 0
  if (-not $kok -or $kok.Tag -ne 0x30) { return $null }
  $c = Ber-Cocuklar $kok.Deger
  if ($c.Count -lt 3 -or $c[2].Tag -ne 0xA2) { return $null }
  $p = Ber-Cocuklar $c[2].Deger
  if ($p.Count -lt 4) { return $null }
  $sonuc = @{ IstekNo = [long](Ber-Sayi $p[0].Deger $true); Hata = [long](Ber-Sayi $p[1].Deger $true); Degerler = [ordered]@{} }
  foreach ($vb in (Ber-Cocuklar $p[3].Deger)) {
    $ic = Ber-Cocuklar $vb.Deger
    if ($ic.Count -lt 2) { continue }
    # Ham: bit maskesi gibi metin olmayan OCTET STRING'ler için çözülmemiş baytlar.
    $sonuc.Degerler[(Oid-Coz $ic[0].Deger)] = @{ Tag = $ic[1].Tag; Deger = (Ber-Deger $ic[1]); Ham = $ic[1].Deger }
  }
  return $sonuc
}

# ── AĞ ────────────────────────────────────────────────────────────────────

$udp = New-Object System.Net.Sockets.UdpClient(0)
$udp.Client.ReceiveBufferSize = 1048576
$udp.Client.ReceiveTimeout = $ZamanAsimi

function Gonder([string]$ip, [byte[]]$paket) { [void]$udp.Send($paket, $paket.Length, $ip, $Port) }

function Al {
  $uzak = New-Object System.Net.IPEndPoint([Net.IPAddress]::Any, 0)
  try {
    $v = $udp.Receive([ref]$uzak)
    return @{ Ip = $uzak.Address.ToString(); Paket = $v }
  } catch [System.Net.Sockets.SocketException] { return $null }
}

function Sor([string]$ip, [byte]$tur, [string[]]$oidler) {
  for ($deneme = 0; $deneme -lt 2; $deneme++) {
    $no = Get-Random -Minimum 1 -Maximum 2147483647
    Gonder $ip (Snmp-Istek $no $tur $oidler)
    $bitis = (Get-Date).AddMilliseconds($ZamanAsimi)
    while ((Get-Date) -lt $bitis) {
      $y = Al
      if (-not $y) { break }
      if ($y.Ip -ne $ip) { continue }
      $c = Snmp-Coz $y.Paket
      if ($c -and $c.IstekNo -eq $no) { return $c }
    }
  }
  return $null
}

function Gez([string]$ip, [string]$kok, [int]$azami) {
  $sonuc = [ordered]@{}
  $oid = $kok
  for ($n = 0; $n -lt $azami; $n++) {
    $c = Sor $ip 0xA1 @($oid)
    if (-not $c -or $c.Hata -ne 0 -or $c.Degerler.Count -eq 0) { break }
    $k = @($c.Degerler.Keys)[0]
    $v = $c.Degerler[$k]
    if (-not $k.StartsWith("$kok.") -or $v.Tag -ge 0x80) { break }
    $sonuc[$k] = $v.Deger
    $oid = $k
  }
  return $sonuc
}

# IP hesabı düz aritmetikle: PowerShell'de 0xFFFFFFFF bir Int32 olarak -1
# okunur ve uint32 üzerindeki bit kaydırmasının sonuç türü sürüme göre
# değişir. İkisi de maskeyi sessizce bozup yanlış ağı taratırdı.
function Ip-Sayi([string]$ip) {
  $b = ([Net.IPAddress]::Parse($ip)).GetAddressBytes()
  return [uint64]$b[0] * 16777216 + [uint64]$b[1] * 65536 + [uint64]$b[2] * 256 + [uint64]$b[3]
}
function Sayi-Ip([uint64]$n) {
  return '{0}.{1}.{2}.{3}' -f ([math]::Floor($n / 16777216) % 256), ([math]::Floor($n / 65536) % 256), ([math]::Floor($n / 256) % 256), ($n % 256)
}

function Aralik([string]$ip, [int]$onek) {
  # Büyük ağlarda (/16 gibi) yalnız bu bilgisayarın /24'ü taranır: 65 bin
  # adresi yoklamak dakikalar sürer ve ağ yöneticisini haklı olarak kızdırır.
  if ($onek -lt 22) { $onek = 24 }
  if ($onek -gt 30) { return @($ip) }
  $adet = [uint64][math]::Pow(2, 32 - $onek)
  $n = Ip-Sayi $ip
  $ag = $n - ($n % $adet)
  $liste = New-Object System.Collections.ArrayList
  for ($i = [uint64]1; $i -lt $adet - 1; $i++) { [void]$liste.Add((Sayi-Ip ($ag + $i))) }
  return $liste
}

function Hedefler {
  $liste = New-Object System.Collections.ArrayList
  if ($Hedef.Count) {
    foreach ($h in ($Hedef -join ',').Split(',')) {
      $h = $h.Trim()
      if (-not $h) { continue }
      if ($h -match '^(\d{1,3}(\.\d{1,3}){3})/(\d{1,2})$') { [void]$liste.AddRange(@(Aralik $Matches[1] ([int]$Matches[3]))) }
      else { [void]$liste.Add($h) }
    }
    return $liste
  }
  $adresler = @(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.PrefixLength -ge 8 })
  foreach ($a in $adresler) {
    foreach ($ip in (Aralik $a.IPAddress $a.PrefixLength)) { if ($ip -ne $a.IPAddress -and -not $liste.Contains($ip)) { [void]$liste.Add($ip) } }
  }
  return $liste
}

# ── OID'LER ───────────────────────────────────────────────────────────────

$SYS_DESCR   = '1.3.6.1.2.1.1.1.0'
$SYS_OID     = '1.3.6.1.2.1.1.2.0'
$HR_DESCR    = '1.3.6.1.2.1.25.3.2.1.3.1'
$PRT_SERI    = '1.3.6.1.2.1.43.5.1.1.17.1'
$PRT_TOPLAM  = '1.3.6.1.2.1.43.10.2.1.4.1.1'
$PRT_RENK    = '1.3.6.1.2.1.43.12.1.1.4.1'
$SARF_AD     = '1.3.6.1.2.1.43.11.1.1.6.1'
$SARF_MAX    = '1.3.6.1.2.1.43.11.1.1.8.1'
$SARF_SEVIYE = '1.3.6.1.2.1.43.11.1.1.9.1'
# Cihaz durumu (RFC 2790): hrDeviceStatus ve hrPrinterDetectedErrorState.
# Bit maskesinin anlamına SUNUCU karar verir; tarayıcı baytları onaltılık yollar.
$HR_DURUM    = '1.3.6.1.2.1.25.3.2.1.5.1'
$HR_HATA     = '1.3.6.1.2.1.25.3.5.1.2.1'
# Markaya özel sayaç dalları. Ne anlama geldiklerine SUNUCU karar verir;
# tarayıcı yalnız değerleri getirir.
$OZEL_DALLAR = @{ '1347' = '1.3.6.1.4.1.1347.42.3.1.2.1.1' }

# ── ÇALIŞMA ───────────────────────────────────────────────────────────────

$GOREV = 'Nextus Sayac Tarayici'

# schtasks hata durumunda stderr'e yazar. Windows PowerShell 5.1'de yerel
# komutun stderr'i yönlendirilince $ErrorActionPreference = 'Stop' bunu
# ölümcül hataya çeviriyor ve betik son adımda çöküyordu ("görev yok" bile
# bir hata sayılıyordu). Bu iki fonksiyonda tercih yereldir.
function Gunluk-Kur {
  $ErrorActionPreference = 'SilentlyContinue'
  # Kopya ProgramData yerine kullanıcının kendi klasörüne: yönetici izni
  # istemeden yazılabilir ve görev de bu kullanıcı adına çalışır.
  $hedefKlasor = Join-Path $env:LOCALAPPDATA 'NextusSayacTarayici'
  New-Item -ItemType Directory -Force -Path $hedefKlasor | Out-Null
  $kopya = Join-Path $hedefKlasor 'nextus-sayac-tarayici.ps1'
  Copy-Item -LiteralPath $PSCommandPath -Destination $kopya -Force
  $komut = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$kopya`" -Sessiz"
  try { schtasks.exe /Create /SC DAILY /ST 09:00 /TN $GOREV /TR $komut /F 2>$null | Out-Null } catch { }
  if ($LASTEXITCODE -eq 0) {
    Yaz "Her gün 09:00'da çalışacak şekilde kuruldu. Kaldırmak için: schtasks /Delete /TN `"$GOREV`" /F" `
        "Scheduled to run every day at 09:00. To remove it: schtasks /Delete /TN `"$GOREV`" /F"
  } else {
    Yaz 'Günlük çalışma kurulamadı (Görev Zamanlayıcı izin vermedi).' 'Could not schedule the daily run (Task Scheduler refused).'
  }
}

function Gunluk-Kurulu {
  $ErrorActionPreference = 'SilentlyContinue'
  try { schtasks.exe /Query /TN $GOREV 2>$null | Out-Null } catch { return $false }
  return ($LASTEXITCODE -eq 0)
}

# KENDİNİ GÜNCELLEME. Tarayıcı müşterinin bilgisayarında günlerce, aylarca
# çalışıyor; yeni sürüm için her müşteriye tekrar gidilmesin. Sunucu
# yanıtında güncel sürümü söyler; bu dosya eskiyse aynı sunucudaki şablonu
# indirir, KENDİ anahtarını, adresini ve dilini içine yazar, kendi yerine
# koyar. Bir sonraki çalışma yeni sürümle olur. Şablon beklenen biçimde
# değilse (başlık, yer tutucular, daha yeni sürüm) hiçbir şeye dokunulmaz.
function Kendini-Guncelle([int]$hedefSurum) {
  $ErrorActionPreference = 'SilentlyContinue'
  try {
    $yol = $PSCommandPath
    if (-not $yol -or $hedefSurum -le $SURUM) { return }
    $gecici = "$yol.indirilen"
    Invoke-WebRequest -Uri ($Sunucu.TrimEnd('/') + '/tarayici/nextus-sayac-tarayici.ps1') -OutFile $gecici -UseBasicParsing -ErrorAction Stop
    $sablon = [IO.File]::ReadAllText($gecici, [Text.Encoding]::UTF8)
    Remove-Item -LiteralPath $gecici -Force
    if ($sablon -notmatch 'NEXTUS SERV' -or $sablon -notmatch '\$SURUM = (\d+)') { return }
    $yeniSurum = [int]$Matches[1]
    if ($yeniSurum -le $SURUM) { return }
    foreach ($y in @("'__SUNUCU__'", "'__ANAHTAR__'", "'__DIL__'")) { if (-not $sablon.Contains($y)) { return } }
    $yeni = $sablon.Replace("'__SUNUCU__'", "'$Sunucu'").Replace("'__ANAHTAR__'", "'$Anahtar'").Replace("'__DIL__'", "'$Dil'")
    # BOM şart: Windows PowerShell 5.1 BOM'suz dosyada Türkçe harfleri bozar.
    [IO.File]::WriteAllText("$yol.yeni", $yeni, (New-Object Text.UTF8Encoding($true)))
    Move-Item -LiteralPath "$yol.yeni" -Destination $yol -Force
    Yaz "Tarayıcı güncellendi: sürüm $SURUM → $yeniSurum (bir sonraki çalışmada geçerli)." "Scanner updated: version $SURUM → $yeniSurum (takes effect on the next run)."
  } catch { }
}


# ── ÜCRETSİZ KİP: YEREL RAPOR ────────────────────────────────────────────
# Uyarı kodları, adları, marka listesi ve toner/parça ayrımı sunucudakiyle
# aynı (src/lib/sayac-tarama.ts; i18n sayacTarayici.uyari). Test ikisini
# karşılaştırır: biri değişirse öteki de değişmeli.
$HATA_BITLERI = @(
  '0:80:KAGIT_AZ', '0:40:KAGIT_YOK', '0:20:TONER_AZ', '0:10:TONER_YOK',
  '0:08:KAPAK_ACIK', '0:04:SIKISMA', '0:02:CEVRIMDISI', '0:01:SERVIS_GEREKLI',
  '1:80:KASET_YOK', '1:40:CIKIS_TEPSISI_YOK', '1:20:SARF_TAKILI_DEGIL', '1:10:CIKIS_DOLMAK_UZERE',
  '1:08:CIKIS_DOLU', '1:04:KASET_BOS', '1:02:BAKIM_GECIKTI'
)
$UYARI_AD = @{
  SERVIS_GEREKLI     = @('SERVIS', 'Servis istiyor', 'Service requested')
  BAKIM_GECIKTI      = @('SERVIS', 'Bakım zamanı geçti', 'Maintenance overdue')
  SIKISMA            = @('SERVIS', 'Kâğıt sıkışması', 'Paper jam')
  SARF_TAKILI_DEGIL  = @('SERVIS', 'Sarf takılı değil', 'Supply not installed')
  CIHAZ_ARIZALI      = @('SERVIS', 'Cihaz arızalı', 'Device down')
  TONER_YOK          = @('SARF', 'Toner bitti', 'Out of toner')
  TONER_AZ           = @('SARF', 'Toner az', 'Toner low')
  KAGIT_YOK          = @('BILGI', 'Kâğıt bitti', 'Out of paper')
  KAGIT_AZ           = @('BILGI', 'Kâğıt azaldı', 'Paper low')
  KAPAK_ACIK         = @('BILGI', 'Kapak açık', 'Cover open')
  CEVRIMDISI         = @('BILGI', 'Çevrimdışı', 'Offline')
  KASET_YOK          = @('BILGI', 'Kaset takılı değil', 'Tray missing')
  KASET_BOS          = @('BILGI', 'Kaset boş', 'Tray empty')
  CIKIS_TEPSISI_YOK  = @('BILGI', 'Çıkış tepsisi yok', 'Output tray missing')
  CIKIS_DOLU         = @('BILGI', 'Çıkış tepsisi dolu', 'Output tray full')
  CIKIS_DOLMAK_UZERE = @('BILGI', 'Çıkış tepsisi dolmak üzere', 'Output tray almost full')
}
$MARKALAR = @{ '11' = 'HP'; '236' = 'Samsung'; '253' = 'Xerox'; '367' = 'Ricoh'; '641' = 'Lexmark'; '1248' = 'Epson';
  '1347' = 'Kyocera'; '1602' = 'Canon'; '2385' = 'Sharp'; '2435' = 'Brother'; '18334' = 'Konica Minolta' }
$TONER_KRITIK = 15
$PARCA_KRITIK = 10
$TONER_DISI = 'drum|imaging|waste|at[ıi]k|fuser|f[ıi]r[ıi]n|belt|kay[ıi][sş]|maintenance|bak[ıi]m|developer|geli[sş]tirici|staple|z[ıi]mba|transfer|roller|merdane'
$TONER_ADI = 'toner|cartridge|kartu[sş]|ink|m[üu]rekkep|black|siyah|schwarz|noir|negro|cyan|magenta|yellow|camg[öo]be[ğg]i|macenta|sar[ıi]|cian|gelb'

# Ad 'H' olamaz: PowerShell'de h hazır bir kısayol (Get-History) ve kısayol fonksiyondan önce gelir.
# Yalnız HTML'de anlamı olan beş karakter. Hazır HtmlEncode Türkçe harflerin
# bir kısmını sayısal koda çeviriyordu (â → &#226;); sayfa zaten UTF-8.
function Kacis([object]$x) { return ([string]$x).Replace('&', '&amp;').Replace('<', '&lt;').Replace('>', '&gt;').Replace('"', '&quot;').Replace("'", '&#39;') }
function Cevir([string]$metinTr, [string]$metinEn) { if ($TR) { return $metinTr } return $metinEn }

function Cihaz-Uyarilari($c) {
  $kodlar = New-Object System.Collections.ArrayList
  $hex = [string]$c.hata
  foreach ($b in $HATA_BITLERI) {
    $p = $b.Split(':')
    $i = [int]$p[0]
    if ($hex.Length -lt ($i + 1) * 2) { continue }
    try { $bayt = [Convert]::ToInt32($hex.Substring($i * 2, 2), 16) } catch { continue }
    if ($bayt -band [Convert]::ToInt32($p[1], 16)) { [void]$kodlar.Add($p[2]) }
  }
  if ($c.durumKodu -eq 5) { [void]$kodlar.Add('CIHAZ_ARIZALI') }
  # Sort-Object sırayı korumuyor: tür, sonra bit tablosundaki yer (sunucudaki sırayla aynı).
  $sira = @{ SERVIS = 0; SARF = 1; BILGI = 2 }
  $yer = @{}
  for ($j = 0; $j -lt $kodlar.Count; $j++) { $yer[$kodlar[$j]] = $j }
  return @($kodlar | Sort-Object -Property @{ Expression = { $sira[$UYARI_AD[$_][0]] } }, @{ Expression = { $yer[$_] } })
}

# Sunucudaki sarfYuzdesi ile aynı: eksi seviye ya da sıfır kapasite = bilinmiyor.
function Sarf-Yuzde($s) {
  $mx = [double]$s.max; $sv = [double]$s.seviye
  if ($mx -le 0 -or $sv -lt 0) { return $null }
  return [int][Math]::Max(0, [Math]::Min(100, [Math]::Round(($sv / $mx) * 100, [MidpointRounding]::AwayFromZero)))
}

function Cihaz-Adi($c) {
  $model = ([string]$c.model).Trim()
  if (-not $model) { $model = ([string]$c.sysDescr).Trim() }
  $marka = $null
  if ([string]$c.sysObjectID -match '^1\.3\.6\.1\.4\.1\.(\d+)') { $marka = $MARKALAR[$Matches[1]] }
  if ($marka -and $model -notmatch [regex]::Escape($marka)) { $model = ("$marka $model").Trim() }
  if (-not $model) { $model = Cevir 'Bilinmeyen model' 'Unknown model' }
  return $model
}

# RFC 3805: atık kutusu gibi DOLAN kalemlerde seviye kalan boş yerdir; yani
# her kalemde düşük yüzde "değişmeli" anlamına gelir, tek eşik yeter.
function Sarf-Html($kalemler, [int]$esik) {
  if (-not $kalemler -or $kalemler.Count -eq 0) { return '<span class="sonuk">&mdash;</span>' }
  $parcalar = foreach ($k in $kalemler) {
    if ($null -eq $k.yuzde) {
      $deger = Cevir 'bilinmiyor' 'unknown'
      if ($k.seviye -eq -3) { $deger = Cevir 'kalan var' 'some left' }
      "<span class=`"olcu sonuk`">$(Kacis $k.ad) <b>$deger</b></span>"
    } else {
      $deger = "$($k.yuzde)%"
      if ($TR) { $deger = "%$($k.yuzde)" }
      $sinif = 'olcu'
      if ($k.yuzde -le $esik) { $sinif = 'olcu az' }
      "<span class=`"$sinif`" data-yuzde=`"$($k.yuzde)`">$(Kacis $k.ad) <b>$deger</b></span>"
    }
  }
  return (@($parcalar) -join '')
}

$RAPOR_CSS = @'
*{box-sizing:border-box}
body{margin:0;background:#f4f6f8;color:#14181f;font:15px/1.5 "Segoe UI",-apple-system,BlinkMacSystemFont,Roboto,Arial,sans-serif}
main{max-width:1180px;margin:0 auto;padding:32px 20px 48px}
header{background:#0b1220;color:#fff;border-radius:18px;padding:28px 28px 24px}
header .ust{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#7fe0d6;font-weight:600}
header h1{margin:6px 0 4px;font-size:28px;line-height:1.2}
header p{margin:0;color:#b8c2d0;font-size:14px}
.ozet{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:16px 0}
.kutu{background:#fff;border:1px solid #e3e7ec;border-radius:14px;padding:14px 16px}
.kutu b{display:block;font-size:26px;line-height:1.1;font-variant-numeric:tabular-nums}
.kutu span{color:#5b6573;font-size:13px}
.kutu.dikkat b{color:#c2410c}
.kutu.servis b{color:#b91c1c}
.tablo{background:#fff;border:1px solid #e3e7ec;border-radius:14px;overflow-x:auto}
table{border-collapse:collapse;width:100%;min-width:860px}
th{text-align:left;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#5b6573;background:#f8fafb;padding:10px 12px;border-bottom:1px solid #e3e7ec}
td{padding:12px;border-bottom:1px solid #eef1f4;vertical-align:top}
tr:last-child td{border-bottom:0}
td .alt{display:block;color:#5b6573;font-size:12.5px;font-family:Consolas,monospace}
.mono{font-family:Consolas,monospace;font-size:13px}
.sayi{font-variant-numeric:tabular-nums;text-align:right;white-space:nowrap}
.olcu,.uyari{display:inline-block;margin:0 6px 6px 0;padding:3px 9px;border-radius:999px;font-size:12.5px;background:#eef6f5;color:#0f5f58;white-space:nowrap}
.olcu.az{background:#fff1e6;color:#9a3412}
.olcu.sonuk{background:#f1f3f5}
.olcu.sonuk,.sonuk{color:#7a8492}
.uyari.servis{background:#fde8e8;color:#991b1b}
.uyari.sarf{background:#fff1e6;color:#9a3412}
.uyari.bilgi{background:#f1f3f5;color:#4b5563}
.bos{background:#fff;border:1px dashed #c9d1da;border-radius:14px;padding:22px;color:#3d4653}
.cta{margin-top:18px;background:#0b1220;color:#e7ecf3;border-radius:18px;padding:22px 24px;display:flex;gap:18px;align-items:center;justify-content:space-between;flex-wrap:wrap}
.cta p{margin:0;max-width:720px}
.cta a{background:#14b8a6;color:#04201d;text-decoration:none;font-weight:700;padding:11px 18px;border-radius:12px;white-space:nowrap}
.not{margin-top:14px;color:#5b6573;font-size:12.5px}
@media (max-width:760px){.ozet{grid-template-columns:repeat(2,1fr)}}
@media print{body{background:#fff}.cta a{border:1px solid #0b1220}}
'@

function Rapor-Yaz($liste, [int]$taranan) {
  $kultur = [Globalization.CultureInfo]::GetCultureInfo('en-GB')
  if ($TR) { $kultur = [Globalization.CultureInfo]::GetCultureInfo('tr-TR') }
  $simdi = Get-Date
  $satirlar = New-Object System.Collections.ArrayList
  $tonerAz = 0; $servis = 0; $toplamSayac = [long]0
  foreach ($c in @($liste)) {
    if ($null -eq $c) { continue }
    $kodlar = @(Cihaz-Uyarilari $c)
    $tonerler = New-Object System.Collections.ArrayList
    $parcalar = New-Object System.Collections.ArrayList
    $enAzToner = 101; $enAzParca = 101
    foreach ($s in @($c.sarf)) {
      if ($null -eq $s) { continue }
      $sarfAdi = ([string]$s.ad).Trim()
      if (-not $sarfAdi) { continue }
      $y = Sarf-Yuzde $s
      $kalem = @{ ad = $sarfAdi; yuzde = $y; seviye = [long]$s.seviye }
      if (($sarfAdi -notmatch $TONER_DISI) -and ($sarfAdi -match $TONER_ADI)) {
        if ($null -ne $y -and $y -lt $enAzToner) { $enAzToner = $y }
        [void]$tonerler.Add($kalem)
      } else {
        if ($null -ne $y -and $y -lt $enAzParca) { $enAzParca = $y }
        [void]$parcalar.Add($kalem)
      }
    }
    $servisVar = @($kodlar | Where-Object { $UYARI_AD[$_][0] -eq 'SERVIS' }).Count -gt 0
    $sarfVar = @($kodlar | Where-Object { $UYARI_AD[$_][0] -eq 'SARF' }).Count -gt 0
    if ($servisVar) { $servis++ }
    if ($enAzToner -le $TONER_KRITIK) { $tonerAz++ }
    if ($null -ne $c.toplam) { $toplamSayac += [long]$c.toplam }
    # Panel sırasıyla aynı: servis isteyen → toneri biten → parça ömrü → kalanlar.
    $oncelik = 2000
    if ($servisVar) { $oncelik = 0 }
    elseif ($sarfVar -or $enAzToner -le $TONER_KRITIK) { $oncelik = 1000 + $enAzToner }
    elseif ($enAzParca -le $PARCA_KRITIK) { $oncelik = 1500 + $enAzParca }
    [void]$satirlar.Add(@{ c = $c; kodlar = $kodlar; tonerler = $tonerler; parcalar = $parcalar; oncelik = $oncelik })
  }
  $sirali = @($satirlar | Sort-Object -Property @{ Expression = { $_.oncelik } }, @{ Expression = { [string]$_.c.ip } })
  $n = $sirali.Count

  $baslik = Cevir 'Ağınızdaki makineler' 'Printers on your network'
  $dilKodu = 'en'
  if ($TR) { $dilKodu = 'tr' }
  $sb = New-Object System.Text.StringBuilder
  [void]$sb.Append("<!doctype html><html lang=`"$dilKodu`"><head><meta charset=`"utf-8`"><meta name=`"viewport`" content=`"width=device-width, initial-scale=1`">")
  [void]$sb.Append("<title>$(Kacis $baslik) — Nextus Servis</title><style>$RAPOR_CSS</style></head><body><main>")
  [void]$sb.Append("<header><div class=`"ust`">Nextus Servis · $(Kacis (Cevir 'Ücretsiz ağ taraması' 'Free network scan'))</div><h1>$(Kacis $baslik)</h1>")
  $altSatir = (Cevir '{0} · {1} · {2} adres tarandı' '{0} · {1} · {2} addresses scanned') -f $simdi.ToString('d MMMM yyyy HH:mm', $kultur), $env:COMPUTERNAME, $taranan.ToString('N0', $kultur)
  [void]$sb.Append("<p>$(Kacis $altSatir)</p></header>")

  [void]$sb.Append('<section class="ozet">')
  [void]$sb.Append("<div class=`"kutu`" data-olcu=`"bulunan`"><b>$n</b><span>$(Kacis (Cevir 'Bulunan makine' 'Printers found'))</span></div>")
  [void]$sb.Append("<div class=`"kutu dikkat`" data-olcu=`"toner`"><b>$tonerAz</b><span>$(Kacis (Cevir "Toneri bitmek üzere (%$TONER_KRITIK ve altı)" "Toner nearly out ($TONER_KRITIK% or less)"))</span></div>")
  [void]$sb.Append("<div class=`"kutu servis`" data-olcu=`"servis`"><b>$servis</b><span>$(Kacis (Cevir 'Servis isteyen' 'Requesting service'))</span></div>")
  [void]$sb.Append("<div class=`"kutu`" data-olcu=`"sayac`"><b>$($toplamSayac.ToString('N0', $kultur))</b><span>$(Kacis (Cevir 'Toplam sayaç' 'Total counter'))</span></div>")
  [void]$sb.Append('</section>')

  if ($n -eq 0) {
    [void]$sb.Append("<div class=`"bos`"><b>$(Kacis (Cevir 'Bu ağda yazıcı bulunamadı.' 'No printers were found on this network.'))</b><br>")
    [void]$sb.Append((Kacis (Cevir 'Bilgisayar makinelerle aynı ağda mı? Bazı makinelerde SNMP kapalı gelir; makinenin ağ ayarlarından açılabilir.' 'Is this computer on the same network as the printers? Some printers ship with SNMP turned off; it can be enabled in the printer''s network settings.')))
    [void]$sb.Append('</div>')
  } else {
    [void]$sb.Append('<div class="tablo"><table><thead><tr>')
    foreach ($b in @((Cevir 'Makine' 'Device'), (Cevir 'Seri no' 'Serial'), (Cevir 'Sayaç' 'Counter'), 'Toner', (Cevir 'Parça ömrü' 'Parts'), (Cevir 'Makinenin bildirdiği' 'Reported by the device'))) {
      [void]$sb.Append("<th>$(Kacis $b)</th>")
    }
    [void]$sb.Append('</tr></thead><tbody>')
    foreach ($r in $sirali) {
      $c = $r.c
      $sayac = '&mdash;'
      if ($null -ne $c.toplam) { $sayac = ([long]$c.toplam).ToString('N0', $kultur) }
      $uyariHtml = '<span class="sonuk">' + (Kacis (Cevir 'Sorun bildirmiyor' 'No issues reported')) + '</span>'
      if ($r.kodlar.Count) {
        # Tür adı küçük harfe değişmez kültürle çevrilir: tr-TR'de 'BILGI' → 'bılgı' olurdu.
        $uyariHtml = (@($r.kodlar | ForEach-Object { $t = $UYARI_AD[$_]; "<span class=`"uyari $($t[0].ToLowerInvariant())`" data-kod=`"$_`">$(Kacis (Cevir $t[1] $t[2]))</span>" }) -join '')
      }
      [void]$sb.Append("<tr data-ip=`"$(Kacis $c.ip)`"><td><b>$(Kacis (Cihaz-Adi $c))</b><span class=`"alt`">$(Kacis $c.ip)</span></td>")
      [void]$sb.Append("<td class=`"mono`">$(Kacis $c.seri)</td><td class=`"sayi`">$sayac</td>")
      [void]$sb.Append("<td>$(Sarf-Html $r.tonerler $TONER_KRITIK)</td><td>$(Sarf-Html $r.parcalar $PARCA_KRITIK)</td><td>$uyariHtml</td></tr>")
    }
    [void]$sb.Append('</tbody></table></div>')
  }

  $link = $SiteAdresi.TrimEnd('/') + '/?kaynak=tarayici'
  [void]$sb.Append("<section class=`"cta`"><p><b>$(Kacis (Cevir 'Bu sayaçları her ay tek tek toplamanız gerekmiyor.' 'You do not have to collect these counters one by one every month.'))</b> ")
  [void]$sb.Append((Kacis (Cevir 'Nextus Servis aynı tarayıcıyla sayaçları her gün kendiliğinden toplar, ay sonunda faturaya çevirir; toneri bitmek üzere olan ve arıza bildiren makineyi müşteriniz aramadan önce gösterir.' 'Nextus Servis collects these counters automatically every day with the same scanner, turns them into invoices at month end, and shows the printer that is running out of toner or reporting a fault before your customer calls.')))
  [void]$sb.Append("</p><a href=`"$(Kacis $link)`">$(Kacis (Cevir 'Nextus Servis''i inceleyin' 'See Nextus Servis')) &rarr;</a></section>")
  [void]$sb.Append("<p class=`"not`">$(Kacis (Cevir 'Bu rapor yalnız bu bilgisayarda oluşturuldu; tarama sonucu hiçbir yere gönderilmedi. Tarayıcı makinelerde hiçbir ayarı değiştirmez, yalnız okur.' 'This report was created on this computer only; the scan result was not sent anywhere. The scanner changes no settings on the printers; it only reads.'))</p>")
  [void]$sb.Append('</main></body></html>')

  $klasor = $RaporKlasoru
  if (-not $klasor) { $klasor = [Environment]::GetFolderPath('Desktop') }
  if (-not $klasor -or -not (Test-Path -LiteralPath $klasor)) { $klasor = $env:TEMP }
  $dosyaAdi = (Cevir 'Nextus-Makine-Raporu-' 'Nextus-Printer-Report-') + $simdi.ToString('yyyy-MM-dd-HHmm')
  $htmlYol = Join-Path $klasor "$dosyaAdi.html"
  $csvYol = Join-Path $klasor "$dosyaAdi.csv"
  [IO.File]::WriteAllText($htmlYol, $sb.ToString(), (New-Object Text.UTF8Encoding($false)))

  # Excel için: noktalı virgül ayraçlı, BOM'lu UTF-8. Cihazdan gelen metin
  # = + - @ ile başlıyorsa formül sanılmasın diye başına kesme işareti.
  $hucre = { param($v) $s = [string]$v; if ($s -match '^[=+\-@]') { $s = "'" + $s }; '"' + $s.Replace('"', '""') + '"' }
  $kalemMetni = { param($l) (@($l | ForEach-Object { if ($null -ne $_.yuzde) { "$($_.ad) $($_.yuzde)%" } else { "$($_.ad) ?" } }) -join ', ') }
  $csv = New-Object System.Text.StringBuilder
  [void]$csv.AppendLine((Cevir 'IP;Makine;Seri no;Toplam sayaç;Toner;Parça ömrü;Makinenin bildirdiği' 'IP;Device;Serial;Total counter;Toner;Parts;Reported by the device'))
  foreach ($r in $sirali) {
    $uyariMetni = (@($r.kodlar | ForEach-Object { Cevir $UYARI_AD[$_][1] $UYARI_AD[$_][2] }) -join ', ')
    $alanlar = @($r.c.ip, (Cihaz-Adi $r.c), $r.c.seri, $r.c.toplam, (& $kalemMetni $r.tonerler), (& $kalemMetni $r.parcalar), $uyariMetni)
    [void]$csv.AppendLine((@($alanlar | ForEach-Object { & $hucre $_ }) -join ';'))
  }
  [IO.File]::WriteAllText($csvYol, $csv.ToString(), (New-Object Text.UTF8Encoding($true)))

  return @{ html = $htmlYol; csv = $csvYol; bulunan = $n; tonerAz = $tonerAz; servis = $servis }
}

if ($GunlukKur -and -not $Ucretsiz) { Gunluk-Kur }

if ($Ucretsiz -and -not $Kuru) {
  Yaz 'Ücretsiz tarama: sonuç hiçbir yere gönderilmez, bu bilgisayarda rapor olarak açılır.' `
      'Free scan: nothing is sent anywhere; the result opens as a report on this computer.'
}
if (-not $Ucretsiz -and -not $Kuru -and $Sunucu -like '__*') {
  Yaz 'Bu dosyada sunucu adresi yok. Nextus Servis > Sayaçlar > Ağ Tarayıcı ekranından yeniden indirin.' `
      'This file has no server address. Download it again from Nextus Servis > Meters > Network scanner.'
  if (-not $Sessiz) { [void](Read-Host) }
  exit 2
}

$hedefler = @(Hedefler)
Yaz "Taranıyor: $($hedefler.Count) adres..." "Scanning $($hedefler.Count) addresses..."

# 1) Keşif: her adrese tek soru, cevapları topluca bekle.
$kesif = @{}
$sayac = 0
foreach ($ip in $hedefler) {
  $no = 100000 + $sayac
  try { Gonder $ip (Snmp-Istek $no 0xA0 @($SYS_OID, $PRT_TOPLAM)) } catch { }
  $sayac++
  if ($sayac % 64 -eq 0) { Start-Sleep -Milliseconds 20 }
}
while ($true) {
  $y = Al
  if (-not $y) { break }
  if ($kesif.ContainsKey($y.Ip)) { continue }
  $c = Snmp-Coz $y.Paket
  if (-not $c) { continue }
  $t = $c.Degerler[$PRT_TOPLAM]
  # Yazıcı = standart yazıcı sayacını veren cihaz. Anahtar, kamera gibi
  # SNMP konuşan başka cihazlar bu sayacı vermez ve listeye girmez.
  if ($t -and $t.Tag -lt 0x80 -and $null -ne $t.Deger) { $kesif[$y.Ip] = $c }
}

Yaz "Bulunan yazıcı: $($kesif.Count)" "Printers found: $($kesif.Count)"

# 2) Ayrıntı: her yazıcıdan seri, model, sayaç, renkler, sarf.
$cihazlar = New-Object System.Collections.ArrayList
foreach ($ip in $kesif.Keys) {
  $g = Sor $ip 0xA0 @($SYS_DESCR, $SYS_OID, $HR_DESCR, $PRT_SERI, $PRT_TOPLAM)
  if (-not $g) { continue }
  $deger = { param($o) $v = $g.Degerler[$o]; if ($v -and $v.Tag -lt 0x80) { $v.Deger } else { $null } }
  $sysOid = & $deger $SYS_OID
  $renkler = @((Gez $ip $PRT_RENK 16).Values | ForEach-Object { [string]$_ })
  $adlar = @((Gez $ip $SARF_AD 16).GetEnumerator())
  $maxlar = Gez $ip $SARF_MAX 16
  $seviyeler = Gez $ip $SARF_SEVIYE 16
  $sarf = New-Object System.Collections.ArrayList
  foreach ($a in $adlar) {
    $idx = $a.Key.Substring($SARF_AD.Length + 1)
    $mx = $maxlar["$SARF_MAX.$idx"]; $sv = $seviyeler["$SARF_SEVIYE.$idx"]
    if ($null -ne $mx -and $null -ne $sv) { [void]$sarf.Add([ordered]@{ ad = [string]$a.Value; max = [long]$mx; seviye = [long]$sv }) }
  }
  # Durum ayrı soruluyor: bu tabloyu bilmeyen eski cihaz (SNMPv1 gibi) bütün
  # isteği hatayla geri çevirir; sayaç sorusunu onunla birlikte kaybetmeyelim.
  $durumKodu = $null; $hata = $null
  $dr = Sor $ip 0xA0 @($HR_DURUM, $HR_HATA)
  if ($dr -and $dr.Hata -eq 0) {
    $v = $dr.Degerler[$HR_DURUM]; if ($v -and $v.Tag -eq 0x02) { $durumKodu = $v.Deger }
    $v = $dr.Degerler[$HR_HATA]; if ($v -and $v.Tag -eq 0x04) { $hata = (@($v.Ham) | ForEach-Object { ([byte]$_).ToString('x2') }) -join '' }
  }
  $ozel = [ordered]@{}
  if ($sysOid -match '^1\.3\.6\.1\.4\.1\.(\d+)') {
    $dal = $OZEL_DALLAR[$Matches[1]]
    if ($dal) { foreach ($e in (Gez $ip $dal 32).GetEnumerator()) { if ($e.Value -is [long]) { $ozel[$e.Key] = $e.Value } } }
  }
  [void]$cihazlar.Add([ordered]@{
    ip = $ip
    sysObjectID = $sysOid
    sysDescr = & $deger $SYS_DESCR
    model = & $deger $HR_DESCR
    seri = & $deger $PRT_SERI
    toplam = & $deger $PRT_TOPLAM
    renkler = [object[]]$renkler
    sarf = [object[]]$sarf.ToArray()
    ozel = $ozel
    durumKodu = $durumKodu
    hata = $hata
  })
}
$udp.Close()

$govde = [ordered]@{ surum = $SURUM; bilgisayar = $env:COMPUTERNAME; taranan = $hedefler.Count; cihazlar = [object[]]$cihazlar.ToArray() }
$json = ConvertTo-Json -InputObject $govde -Depth 6 -Compress

if ($Kuru) { Write-Output $json; exit 0 }

if ($Ucretsiz) {
  try {
    $rapor = Rapor-Yaz ($cihazlar.ToArray()) ($hedefler.Count)
  } catch {
    Yaz "Rapor yazılamadı: $($_.Exception.Message)" "Could not write the report: $($_.Exception.Message)"
    if (-not $Sessiz) { [void](Read-Host) }
    exit 1
  }
  Yaz "Toneri bitmek üzere: $($rapor.tonerAz) · Servis isteyen: $($rapor.servis)" "Toner nearly out: $($rapor.tonerAz) · Requesting service: $($rapor.servis)"
  Yaz "Rapor: $($rapor.html)" "Report: $($rapor.html)"
  Yaz "Excel için: $($rapor.csv)" "For Excel: $($rapor.csv)"
  if (-not $Sessiz) {
    try { Invoke-Item -LiteralPath $rapor.html } catch { }
    Yaz 'Kapatmak için Enter.' 'Press Enter to close.'
    [void](Read-Host)
  }
  exit 0
}

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
try {
  $cevap = Invoke-RestMethod -Uri ($Sunucu.TrimEnd('/') + '/api/sayac/tarayici') -Method Post `
    -Body ([Text.Encoding]::UTF8.GetBytes($json)) -ContentType 'application/json; charset=utf-8' `
    -Headers @{ Authorization = "Bearer $Anahtar"; 'x-dil' = $Dil } -UseBasicParsing
} catch {
  $mesaj = $_.ErrorDetails.Message
  try { $mesaj = ($mesaj | ConvertFrom-Json).error } catch { }
  if (-not $mesaj) { $mesaj = $_.Exception.Message }
  Yaz "Gönderilemedi: $mesaj" "Could not send: $mesaj"
  if (-not $Sessiz) { [void](Read-Host) }
  exit 1
}

if ($cevap.surum) { Kendini-Guncelle ([int]$cevap.surum) }

$o = $cevap.ozet
Yaz "Sistemdeki cihazla eşleşen: $($o.eslesen)" "Matched to a device in the system: $($o.eslesen)"
if ($cevap.otomatik) {
  Yaz "Sayaç olarak yazılan: $($o.yazilan)" "Recorded as meter readings: $($o.yazilan)"
} else {
  Yaz "Onay bekleyen okuma: $($o.yazilabilir) — panelde Sayaçlar > Ağ Tarayıcı ekranından onaylayın." `
      "Readings awaiting approval: $($o.yazilabilir) — approve them in the panel under Meters > Network scanner."
}
foreach ($c in @($cevap.cihazlar | Where-Object { $_.durum -eq 'ESLESMEDI' })) {
  Yaz "  Sistemde yok: $($c.marka) $($c.model) · seri $($c.seri) · $($c.ip)" "  Not in the system: $($c.marka) $($c.model) · serial $($c.seri) · $($c.ip)"
}
# İlk elle çalıştırmada günlük çalışmayı teklif et: sayaç, toner ve arıza
# durumu ancak tarayıcı her gün çalışırsa güncel kalır. Komut yazdırmıyoruz.
if (-not $Sessiz -and -not $GunlukKur -and -not (Gunluk-Kurulu)) {
  Yaz '' ''
  Yaz 'Bu bilgisayarda her gün 09:00''da kendiliğinden çalışsın mı? Toner ve arıza durumu her gün güncellenir. (E/H)' `
      'Run automatically on this computer every day at 09:00? Toner and fault status stay up to date. (Y/N)'
  $c = [string](Read-Host)
  if ($c.Trim() -match '^(e|evet|y|yes)$') { Gunluk-Kur }
}
if (-not $Sessiz) { Yaz 'Kapatmak için Enter.' 'Press Enter to close.'; [void](Read-Host) }
exit 0
