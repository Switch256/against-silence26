# Sunum metni (Türkçe, 5 dakika + 2 dakika soru)

Pazar 15 Kasım, 15:00. Slaytlar İngilizce (`/slides`), konuşma Türkçe. Toplam yaklaşık 4 dakika 45 saniye;
canlı gösteri için 15 saniye pay bırakıldı. Köşeli parantezler sahne notudur, okunmaz.

## 1. Açılış (20 sn) · Slayt 1

Merhaba, biz **Against the Silence** takımıyız. Projemizin adı **AEGIS-MEDLINK**.
Sloganımız: bağlantının ötesinde sağlık. Astronotun sağlığını, Dünya sustuğunda bile izleyen bir yazılım yaptık.

## 2. Sorun (45 sn) · Slayt 2

Uluslararası Uzay İstasyonu'nda bir astronotun nabzı yükselirse, yerdeki doktor bunu saniyeler içinde görür.
Mars yolunda durum farklı. Bir sinyalin Dünya'ya ulaşması 22 dakikaya kadar sürer. Soru sorup cevap almak bunun iki katı.
Güneş, Dünya ile Mars'ın arasına girdiğinde ise yaklaşık iki hafta hiç bağlantı yoktur.
Bir sağlık olayı bu kadar bekleyemez. Ve bağlantı yokken tek bir tıbbi kayıt bile kaybolmamalıdır.

## 3. Çözüm (60 sn) · Slayt 3

Çözümümüz üç parçadan oluşuyor.

**AEGIS** uzay aracının içinde çalışır, bağlantıya ihtiyaç duymaz. Her astronotun kendi normalini öğrenir.
Olağan dışı bir ölçüm gördüğünde nedenini sade bir dille söyler ve doktorların önceden yazdığı adımları gösterir.
Burada yapay zekâ modeli yok; kurallar ve istatistik var. Bu yüzden her uyarı açıklanabilir.

**PulseBrief** her olayı üç katmana böler: başlık, bağlam, kanıt. En önemli 120 bayt, en kısa bağlantı penceresinden bile geçer.

**MEDLINK** bu mesajları gerçek BPv7 protokolüyle taşır. Bu, uzay için tasarlanmış, gecikmeye dayanıklı bir ağ protokolüdür.
Bağlantı koptuğunda mesajlar araçta bekler, bağlantı gelince sırayla Dünya'ya ulaşır. Doktorun cevabı da aynı yoldan geri döner.

## 4. Canlı gösteri (90 sn) · againstsilence.earth/demo

[Konsolu aç. Solda astronot ekranı, ortada 3B görünüm, sağda Dünya konsolu.]

Şu an bağlantı açık. Solda astronotumuzun nabzını görüyorsunuz. Veriler simülasyondur ve ekranda böyle etiketlidir.

[**Cut link** düğmesine bas.]

Şimdi bağlantıyı kesiyorum. Dünya artık bizi duymuyor.

[Demo controls → **Physiological anomaly**.]

Astronotun nabzı dinlenme hâlinde yükseliyor. AEGIS bunu hemen fark etti: uyarı, nedeni ve yapılacaklar ekranda.
Dünya'ya gidemeyen mesajlar burada, araçta bekliyor. Hiçbiri kaybolmadı.

[**Restore link** düğmesine bas.]

Bağlantı geri geldi. Önce başlıklar geçti, ardından bağlam ve kanıt. Sağda, Dünya'daki doktor olayı görüyor.

[Sağdaki hazır cevaplardan birine bas, **Send**.]

Doktor cevap yazıyor ve cevap astronota ulaşıyor.

## 5. NASA verisi (35 sn) · Slayt 5

NASA verisini yalnızca kaynak göstermedik, sistemin içinde kullandık.
NASA DONKI'den gelen gerçek uzay havası olayları AEGIS'e girer; güçlü bir Güneş fırtınasında mürettebata sığınak uyarısı verilir.
Mayıs 2024'teki gerçek fırtınayı sistemde yeniden oynatabiliyoruz.
Yer istasyonları NASA'nın Derin Uzay Ağı'nın gerçek istasyonlarıdır. Dünya, yıldızlar ve uzay aracı modeli de NASA kaynaklıdır.

## 6. Sonuçlar ve kapanış (35 sn) · Slayt 6 ve 7

Test çalışmamızda 2,7 megabaytlık ham veri yerine yalnızca 21 kilobayt gönderdik: yaklaşık 128 kat daha az.
Tekrarlanan kesintilerde tek bir olay bile kaybolmadı. 60 otomatik testimiz geçiyor.

Bu bir araştırma prototipidir, tıbbi cihaz değildir. Ama aynı tasarım doktordan uzak her yerde işe yarar:
araştırma istasyonları, gemiler, uzak klinikler, afet bölgeleri.

Sessizlik sürerken astronot asla yalnız değildir. Teşekkür ederiz.

## Olası sorular

- **Neden yapay zekâ kullanmadınız?** Tıbbi bir uyarı açıklanabilir olmalı. Kurallar ve istatistik, sıradan bir işlemcide bağlantısız çalışır ve her kararın nedenini söyler.
- **Veriler gerçek mi?** Astronot verileri simülasyondur ve etiketlidir. Uzay havası verisi gerçektir (NASA DONKI).
- **BPv7 gerçekten çalışıyor mu?** Evet. İki ayrı dtn7-rs düğümü arasında gerçek paketler (bundle) gidip geliyor; ekrandaki sayaçlar bu düğümlerden okunuyor.
- **Gecikme neden 14 dakika değil?** Gösteri için ışık gecikmesi sıkıştırıldı; ekranda gerçek değer (14 dakika) yazıyor.
- **Sırada ne var?** Uçuşa uygun giyilebilir sensörler, daha fazla yaşamsal bulgu ve kontrol listelerinin uçuş doktorlarınca gözden geçirilmesi.
