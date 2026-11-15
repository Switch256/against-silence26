# Sunum metni (Türkçe, 5 dakika + 2 dakika soru)

Pazar 15 Kasım, 15:00. Slaytlar Türkçe (`/slides/tr`, PDF: `aegis-medlink-slaytlar-tr.pdf`; İngilizcesi `/slides`), konuşma Türkçe. Toplam yaklaşık 4 dakika 45 saniye;
canlı gösteri için 15 saniye pay bırakıldı. Köşeli parantezler sahne notudur, okunmaz.

## 1. Açılış (20 sn) · Slayt 1

Merhaba, biz **Against the Silence** takımıyız. Projemizin adı **AEGIS-MEDLINK**.
Görevimiz: uzay görevlerindeki astronotlar için sağlık izleme yazılımı geliştirmek.
Biz, Dünya sustuğunda bile çalışan bir yazılım yaptık.

## 2. Sorun (45 sn) · Slayt 2

Görevin 182. günü. Astronotumuz Aylin'in nabzı, dinlenirken yükseliyor.
Uluslararası Uzay İstasyonu'nda olsa, yerdeki doktor bunu saniyeler içinde görürdü.
Ama Aylin Dünya'dan 250 milyon kilometre uzakta. Haber Dünya'ya 14 dakikada ulaşır.
Güneş, Dünya ile Mars'ın arasına girdiğinde ise yaklaşık iki hafta hiç bağlantı yoktur.
[Aylin hayali bir mürettebat üyesi, verileri simülasyon. Soru gelirse söyle.]
Bir sağlık olayı bu kadar bekleyemez. Ve bağlantı yokken tek bir tıbbi kayıt bile kaybolmamalıdır.

## 3. Çözüm (60 sn) · Slayt 3

Çözümümüz üç parçadan oluşuyor.

**AEGIS** uzay aracının içinde çalışır, bağlantıya ihtiyaç duymaz. Her astronotun kendi normalini öğrenir.
Olağan dışı bir ölçüm gördüğünde nedenini sade bir dille söyler ve doktorların önceden yazdığı adımları gösterir.
Burada yapay zekâ modeli yok; kurallar ve istatistik var. Bu yüzden her uyarı açıklanabilir.

**PulseBrief** her olayı üç katmana böler: başlık, bağlam, kanıt. En önemli 120 bayt, en kısa bağlantı penceresinden bile geçer.

**MEDLINK** bu mesajları gerçek BPv7 protokolüyle taşır. Bu, uzay için tasarlanmış, gecikmeye dayanıklı bir ağ protokolüdür.
Bağlantı koptuğunda mesajlar araçta bekler, bağlantı gelince en acil olan önce Dünya'ya ulaşır. Doktorun cevabı da aynı yoldan geri döner.

Bu bir hayal değil: NASA, gecikmeye dayanıklı ağı bugün Uzay İstasyonu'nda kullanıyor. Biz de aynı ailenin güncel standardı BPv7'yi, iki gerçek ağ düğümü arasında çalıştırıyoruz.

## 4. Canlı gösteri (90 sn) · Slayt 4, sonra againstsilence.earth/demo

[Konsolu aç. Solda astronot ekranı, ortada 3B görünüm, sağda Dünya konsolu.]

Şu an bağlantı açık. Solda astronotumuzun nabzını görüyorsunuz. Veriler simülasyondur ve ekranda böyle etiketlidir.

[**Cut link** düğmesine bas.]

Şimdi bağlantıyı kesiyorum. Dünya artık bizi duymuyor.

[**Raise vitals** düğmesine bas (Cut link'in yanında).]

Astronotun nabzı dinlenme hâlinde yükseliyor. AEGIS bunu hemen fark etti: uyarı, nedeni ve yapılacaklar ekranda.
Bağlantı yok ama astronot ne yapacağını biliyor; adımlar Dünya'dan değil, araçtaki AEGIS'ten geliyor.
Dünya'ya gidemeyen mesajlar burada, araçta bekliyor. Hiçbiri kaybolmadı.

[**Restore link** düğmesine bas.]

Bağlantı geri geldi. Önce başlıklar geçti, ardından bağlam ve kanıt. Sağda, Dünya'daki doktor olayı görüyor.

[Sağdaki hazır cevaplardan birine bas, **Send**.]

Doktor cevap yazıyor ve cevap astronota ulaşıyor.

[Slayt 4'e dön.] Test çalışmamızda 2,7 megabaytlık ham veri yerine yalnızca 21 kilobayt gönderdik: 128 kat daha az, hiçbir şey kaybolmadan. 60 otomatik testimiz geçiyor.

## 5. NASA verisi (35 sn) · Slayt 5

Gerçek NASA verisi, gerçek uyarı. Ekrandaki görüntü, Mayıs 2024'teki gerçek Güneş fırtınasının NASA DONKI kayıtlarıyla yeniden oynatılması.
İki Güneş parçacık olayı, araçta acil bir uyarı ve sığınma adımları oluşturuyor; Dünya'ya giden her mesaj da bu bilgiyi taşıyor.
Yer istasyonları NASA'nın Derin Uzay Ağı'nın gerçek istasyonlarıdır. Dünya, yıldızlar ve uzay aracı modeli de NASA kaynaklıdır.

## 6. Dünya'daki etki ve kapanış (35 sn) · Slayt 6 ve 7

Aynı sessizlik Dünya'da da var. Haftalarca limandan uzak gemiler, Antarktika'daki araştırma istasyonları,
Türkiye'de ya da Uganda'da uzmanın saatlerce uzakta olduğu köy klinikleri, depremden sonra ağların çöktüğü bölgeler.
Aynı tasarım bu yerlerin hepsinde işe yarar.

Bu bir araştırma prototipidir, tıbbi cihaz değildir.

Sessizlik sürerken astronot asla yalnız değildir. Teşekkür ederiz.

## Olası sorular

- **Neden yapay zekâ kullanmadınız?** Tıbbi bir uyarı açıklanabilir olmalı. Kurallar ve istatistik, sıradan bir işlemcide bağlantısız çalışır ve her kararın nedenini söyler.
- **Veriler gerçek mi?** Astronot verileri simülasyondur ve etiketlidir. Uzay havası verisi gerçektir (NASA DONKI).
- **BPv7 gerçekten çalışıyor mu?** Evet. İki ayrı dtn7-rs düğümü arasında gerçek paketler (bundle) gidip geliyor; ekrandaki sayaçlar bu düğümlerden okunuyor.
- **Gecikme neden 14 dakika değil?** Gösteri için ışık gecikmesi sıkıştırıldı; ekranda gerçek değer (14 dakika) yazıyor.
- **Sırada ne var?** Uçuşa uygun giyilebilir sensörler, daha fazla yaşamsal bulgu ve kontrol listelerinin uçuş doktorlarınca gözden geçirilmesi.
