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

  NASIL ÇALIŞTIRILIR
    Dosyaya sağ tıklayın > "PowerShell ile çalıştır".
    Soru gelirse "Bir kez çalıştır" (R) deyin.

  SEÇENEKLER
    -Hedef 192.168.1.0/24   yalnız bu ağı tara (virgülle birden çok)
    -Topluluk public        SNMP topluluk adı (cihazda değiştirildiyse)
    -Kuru                   hiçbir şey göndermeden sonucu ekrana yaz
    -GunlukKur              her gün 09:00'da kendiliğinden çalışsın
    -Sessiz                 pencere beklemesin (zamanlanmış çalışma için)
#>
param(
  [string]$Sunucu = '__SUNUCU__',
  [string]$Anahtar = '__ANAHTAR__',
  [string]$Dil = '__DIL__',
  [string[]]$Hedef = @(),
  [int]$Port = 161,
  [string]$Topluluk = 'public',
  [int]$ZamanAsimi = 1500,
  [switch]$Kuru,
  [switch]$Sessiz,
  [switch]$GunlukKur
)

$ErrorActionPreference = 'Stop'
# Çıktı UTF-8: yönlendirilen ya da eski kod sayfalı konsolda Türkçe harfler
# bozuluyordu. Konsol izin vermezse (bazı uzak oturumlar) sessizce geçilir.
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch { }
$SURUM = 2

$TR = ($Dil -ne 'en')
function Yaz([string]$tr, [string]$en) { if ($TR) { Write-Host $tr } else { Write-Host $en } }

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

if ($GunlukKur) { Gunluk-Kur }

if (-not $Kuru -and ($Anahtar -like '__*' -or $Sunucu -like '__*')) {
  Yaz 'Bu dosya panelden indirilmemiş (anahtar yok). Nextus Servis > Sayaçlar > Ağ Tarayıcı ekranından indirin.' `
      'This file was not downloaded from the panel (no key). Download it from Nextus Servis > Meters > Network scanner.'
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
