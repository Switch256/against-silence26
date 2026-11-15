// Türkçe sunum: /slides ile aynı yedi slayt, aynı görseller (yerel sunum için; gönderim İngilizce kalır).
import type { Metadata } from "next";
import { BASE_PATH } from "@/lib/config";
import "../slides.css";

export const metadata: Metadata = {
  title: "Slaytlar (Türkçe)",
  description: "AEGIS-MEDLINK yedi slaytta. Against the Silence takımı, NASA Space Apps Challenge 2026.",
  alternates: { canonical: "/slides/tr", languages: { en: "/slides", tr: "/slides/tr" } },
};

const img = (p: string) => `${BASE_PATH}/media/${p}`;
const N = ({ n }: { n: number }) => <span className="num">{n} / 7</span>;

export default function SlaytlarTR() {
  return (
    <main className="deck" lang="tr">
      {/* 1. Başlık */}
      <section id="s1" className="slide" style={{ justifyContent: "flex-start" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="bg" src={img("hero-poster.jpg")} alt="" style={{ objectPosition: "50% 100%" }} />
        <div className="over">
          <h1>AEGIS-MEDLINK</h1>
          <p className="lead" style={{ color: "var(--color-fg)" }}>Dünya sustuğunda bile çalışan astronot sağlık izleme sistemi.</p>
          <p className="challenge">Görev: <strong>Uzay Görevlerindeki Astronotlar İçin Sağlık İzleme Yazılımı</strong></p>
          <p style={{ marginTop: "calc(var(--u) * 28)" }}>
            <strong>Against the Silence takımı</strong> · Sivas, Türkiye<br />
            Asasira Martin · Mariam Saied · David Kitasho
          </p>
          <p className="small" style={{ marginTop: "calc(var(--u) * 20)" }}>NASA Uluslararası Space Apps Challenge 2026 · againstsilence.earth</p>
        </div>
      </section>

      {/* 2. Bir kişi, bir an */}
      <section id="s2" className="slide">
        <h2>Görevin 182. günü. Aylin&apos;in nabzı dinlenirken yükseliyor.</h2>
        <p className="lead">Uluslararası Uzay İstasyonu&apos;nda bir uçuş doktoru bunu saniyeler içinde görürdü. Aylin ise Dünya&apos;dan 250 milyon km uzakta. Haber Dünya&apos;ya 14 dakikada ulaşır; Güneş araya girdiğinde iki hafta hiç ulaşmaz.</p>
        <div className="cols c3">
          <div className="card"><div className="big">3–22 dk</div><p>Dünya ile Mars arasında bir sinyalin tek yönde yol alma süresi. Soru ve cevap bunun iki katı sürer.</p></div>
          <div className="card"><div className="big">~2 hafta</div><p>Güneş, Dünya ile Mars&apos;ın arasına girdiğinde hiç bağlantı yoktur. Bu yaklaşık her 26 ayda bir olur.</p></div>
          <div className="card"><div className="big">0</div><p>Bağlantı yokken kaybolmasına izin verilebilecek tıbbi olay sayısı.</p></div>
        </div>
        <p className="small" style={{ marginTop: "calc(var(--u) * 30)" }}>Aylin Kaya hayali bir mürettebat üyesidir. Ölçümleri simülasyondur.</p>
        <N n={2} />
      </section>

      {/* 3. Çözüm ve neden uçabilir */}
      <section id="s3" className="slide">
        <h2>Dünya&apos;yı beklemeyen bakım, hiçbir şeyi kaybetmeyen bağlantı.</h2>
        <div className="cols c3">
          <div className="card"><h3>AEGIS</h3><p><strong>Her astronotun normalini bilir.</strong> Araçtaki her ölçümü o kişinin kendi değerleriyle karşılaştırır, neyin olağan dışı olduğunu ve nedenini söyler, şimdi ne yapılacağını gösterir. Kurallar ve istatistik; yapay zekâ modeli yok, bağlantı gerekmez.</p></div>
          <div className="card"><h3>PulseBrief</h3><p><strong>Önce başlık.</strong> Her olay üç katmanda gönderilir: başlık (yaklaşık 120 bayt), bağlam, kanıt. Başlık en kısa bağlantı penceresine bile sığar.</p></div>
          <div className="card"><h3>MEDLINK</h3><p><strong>Hiçbir şey kaybolmaz.</strong> Bağlantı koptuğunda mesajlar araçta bekler, bağlantı gelince en acil olan önce geçer. Doktorların cevabı da aynı yoldan döner.</p></div>
        </div>
        <div className="band">
          <strong>NASA&apos;nın bugün kullandığı teknolojiye dayanır.</strong> NASA, gecikmeye dayanıklı ağı (DTN) bugün Uluslararası Uzay İstasyonu&apos;nda kullanıyor. MEDLINK bu ailenin güncel standardını, Bundle Protocol v7&apos;yi (RFC 9171), iki gerçek ağ düğümü arasında çalıştırır; maket değil.
        </div>
        <N n={3} />
      </section>

      {/* 4. Çalışan sistem, sade sayılar */}
      <section id="s4" className="slide">
        <h2>Çalışıyor. Bağlantıyı kesin, nabzı yükseltin.</h2>
        <div className="shots">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="shot" src={img("shots/console-raise-vitals.jpg")} alt="Bağlantı kesikken Raise vitals düğmesine basıldıktan sonra canlı konsol: mürettebat konsolunda nabız uyarısı ve yapılacak adımlar açık (otur ve dinlen, su iç, yeniden ölç); Dünya’dan cevap gerekmediğini söyleyen not" />
            <p><strong>Bağlantı kesik, nabız yükseldi.</strong> AEGIS uyarıyı araçta verir ve mürettebata ne yapacağını hemen gösterir. Dünya&apos;dan cevap gerekmez. Mesaj araçta bekler.</p>
          </div>
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="shot" src={img("shots/console-restored.jpg")} alt="Bağlantı geri geldikten sonra canlı konsol: mesajlar Dünya konsoluna ulaşmış, doktorun cevabı mürettebata iletilmiş" />
            <p><strong>Bağlantı geri geldi.</strong> Önce başlıklar geçer, Dünya olayı görür, doktorların cevabı mürettebata ulaşır.</p>
          </div>
        </div>
        <div className="cols c3 facts">
          <div><strong>2,7 MB → 21 KB.</strong> Ham ölçümler PulseBrief olarak gönderildi: 128 kat daha küçük, hiçbir şey kaybolmadan.</div>
          <div><strong>0 olay kaybı</strong> tekrarlanan kesintilerde. Araçta bekleyen her mesaj ulaştı.</div>
          <div><strong>Yaklaşık yarım saniye:</strong> bağlantı açıkken bir başlığın karşıya geçme süresi. 60 otomatik test geçiyor.</div>
        </div>
        <N n={4} />
      </section>

      {/* 5. NASA verisi iş başında */}
      <section id="s5" className="slide">
        <h2>Gerçek NASA verisi, gerçek uyarı.</h2>
        <div className="split">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="shot" src={img("shots/console-donki-replay.jpg")} alt="Mayıs 2024'teki gerçek Güneş parçacık olaylarını NASA DONKI kayıtlarıyla yeniden oynatan canlı konsol: araçta uzay havası uyarısı, Dünya konsolunda PulseBrief" />
          <div>
            <p><strong>AEGIS&apos;i NASA DONKI uzay havası verisi besler.</strong> Mayıs 2024&apos;teki gerçek Güneş fırtınası yeniden oynatıldığında, iki Güneş parçacık olayı araçta sığınma adımlarıyla acil bir uyarı oluşturur. Dünya&apos;ya giden her PulseBrief de uzay havası bilgisini taşır.</p>
            <ul style={{ marginTop: "calc(var(--u) * 28)" }}>
              <li><strong>Derin Uzay Ağı:</strong> üç gerçek istasyon, Goldstone, Madrid ve Canberra. Hizmet veren istasyon Dünya&apos;nın dönüşünü izler.</li>
              <li><strong>NASA görselleri ve 3B modelleri:</strong> Blue Marble, Deep Star Maps 2020, ISS, 34 m anten, astronot.</li>
              <li><strong>NASA-STD-3001:</strong> ekran rehberi konsolun tasarımına yön verir.</li>
            </ul>
          </div>
        </div>
        <p className="small" style={{ marginTop: "calc(var(--u) * 24)" }}>Uzay havası çevresel risk olarak gösterilir, mürettebatın aldığı radyasyon dozu olarak değil. Tüm kaynaklar: depodaki ATTRIBUTIONS.md.</p>
        <N n={5} />
      </section>

      {/* 6. Dünya'daki aynı sorun */}
      <section id="s6" className="slide">
        <h2>Aynı sessizlik Dünya&apos;da da var.</h2>
        <p className="lead">Doktordan uzak ve bağlantının zayıf olduğu her yerde, aynı tasarım nöbet tutar ve haberi ulaştırır.</p>
        <div className="cols c4">
          <div className="card"><h3>Denizdeki gemiler</h3><p>Limandan haftalarca uzak mürettebat; pahalı ve kesintili uydu bağlantısı.</p></div>
          <div className="card"><h3>Araştırma istasyonları</h3><p>Antarktika&apos;da aylarca dışarı çıkamadan kışı geçiren ekipler.</p></div>
          <div className="card"><h3>Köy klinikleri</h3><p>Uzmanın saatlerce uzakta olduğu, internetin gidip geldiği Türkiye ve Uganda köyleri.</p></div>
          <div className="card"><h3>Afet bölgeleri</h3><p>Depremden sonra ağlar çöktüğünde sahadaki ekipler.</p></div>
        </div>
        <p style={{ marginTop: "calc(var(--u) * 40)" }}><strong>Sırada:</strong> gerçek giyilebilir sensörler, daha fazla yaşamsal bulgu, daha uzun bağlantı planları ve uçuş doktorlarınca gözden geçirilmiş kontrol listeleri.</p>
        <N n={6} />
      </section>

      {/* 7. Kapanış */}
      <section id="s7" className="slide">
        <h2>Sessizlik sürerken astronot asla yalnız değil.</h2>
        <div className="cols c3">
          <div className="card"><h3>Deneyin</h3><p><a href="https://againstsilence.earth">againstsilence.earth</a><br />Canlı konsol: /demo<br />Önce &quot;Cut link&quot;, sonra &quot;Raise vitals&quot;, en son &quot;Restore link&quot;e basın.</p></div>
          <div className="card"><h3>İnceleyin</h3><p><a href="https://github.com/Switch256/against-silence26">github.com/Switch256/against-silence26</a><br />FastAPI, PostgreSQL, Next.js, dtn7-rs, Blender.</p></div>
          <div className="card"><h3>Dürüst sınırlar</h3><p>Mürettebat verileri simülasyondur ve etiketlidir. Işık gecikmesi gösteri için kısaltılmıştır. Bu bir araştırma prototipidir, tıbbi cihaz değildir.</p></div>
        </div>
        <div className="grow" />
        <p className="small"><strong>Yapay zekâ kullanımı:</strong> fikir takımımıza aittir. Fikri geliştirmek, araştırma, kod, yazım, arayüz tasarımı ve sunum malzemeleri için yapay zekâ araçlarını (ChatGPT, Claude) kullandık; her sonucu kendimiz kontrol ettik. Üründe yapay zekâ modeli yoktur. NASA onayı iddia edilmez.</p>
        <N n={7} />
      </section>
    </main>
  );
}
