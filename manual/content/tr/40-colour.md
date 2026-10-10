## Renk

Klasik modlarda bir piksel için renk seçmezsiniz. Bütün bir hücrenin kullanacağı
iki rengi ve iki bayrağı seçersiniz.

- **MÜREKKEP** açık noktaların rengidir.
- **KÂĞIT** kapalı noktaların rengidir.
- **PARLAK** ikisini de daha açık sürümlerine yükseltir. Hücre başına tek bir
  parlaklık bayrağı vardır; yani mürekkep ve kâğıt ya birlikte parlaktır ya da
  hiçbiri.
- **YANIP SÖNME** gerçek donanımda mürekkep ile kâğıdı saniyede yaklaşık iki kez
  yer değiştirir.

Sol fare düğmesi mürekkeple çizer. Sağ düğme kâğıtla çizer: noktayı kapatır ve
sol düğmenin ayarlayacağı aynı dört değeri ayarlar. Kalemde yan düğme, sağ
düğmenin yaptığını yapar.

**Silgi** ikisinden de farklı bir şey yapar. Noktaları kapatır ve hücrenin
renklerine dokunmaz; hücredeki son noktayı sildiğinde bile. Renkleri de silmek
için boş hücrenin üzerinden yeni bir vuruşla bir kez daha geçin: mürekkep, kâğıt,
parlaklık ve yanıp sönme beyaz üzerine siyaha döner ve üst bir katmanda hücre
yeniden saydam olur. İçinde hâlâ nokta bulunan bir hücre, üzerinden kaç kez
silgiyle geçerseniz geçin renklerini korur.
Silginin **Renkler** seçeneği, hücre renkleri olan ekran modlarında görünür,
bunu değiştirir: Geçerli olanı ayarla noktaları siler ve hücreye çubuktaki
renkleri verir, ZX Paintbrush'ın silme aracı gibi; Koru, varsayılan, yukarıda
anlatılan davranıştır.

Dördünden her biri **mevcudu kullan** konumuna da alınabilir: renk çubuğunda
altındaki damalı kutu. Bir vuruş o zaman her hücrenin o kısmını sizin ayarınızı
yazmak yerine olduğu gibi bırakır. MÜREKKEP, KÂĞIT ve PARLAK'ı mevcuda alıp
YANIP SÖNME'yi açın; doldurma aracının **Yalnızca öznitelikleri doldur**
seçeneği bütün bir alanı hiçbir rengi değiştirmeden yanıp söndürür. Shift+B ve
Shift+F, PARLAK ile YANIP SÖNME'yi değiştirir, Shift+T ise dördünü de mevcuda
alır. ULAplus'ta PARLAK ve YANIP SÖNME CLUT'u seçer; bu yüzden CLUT seçicisinde
her hücrenin kendi CLUT'unu koruyan tek bir kutu vardır.

### Çizim modları

Çizim modu bir vuruşun ne yaptığını değiştirir. Oturumlar arasında korunur; bu
yüzden Normal dışında bir şeye ayarlandığında durum çubuğu onu gösterir – bu
modların bazılarında vuruş görünür hiçbir şey bırakmaz ve aksi halde nedenini
anlamanın yolu olmazdı.

Üst şeritte üç düğme vardır: **Çizim modu**, **Hücre aracı** ve **Yansıtma**.
Her biri geçerli seçimi gösterir. Üzerine tıklayın, altında diğer seçeneklerin
küçük bir ızgarası açılır; birine tıklayın, ızgara kapanır. Hiçbir şeyi
değiştirmeden kapatmak için Escape'e basın ya da başka bir yere tıklayın. Çizim
modu ve Yansıtma birlikte çalışır: XOR ve Yatay ayarlıyken bir darbe,
yansıtılmış bir XOR darbesidir. Hücre aracı, biri açıkken, her darbeyi devralır.

{{draw-modes}}

Fırçanın tüm biçimleri, doldurma, şekiller, Bézier eğrisi, yazı, **Damgalar**
panelindeki damgalar ve degradenin sol düğmesi çizim moduna uyar. Silgi,
damlalık, bir seçimi taşıma, yapıştırma ve silme, **Dönüşüm** paneli, **Yalnızca
öznitelikleri doldur** seçeneği ile Değiştir ve Yeniden renklendir düğmeleri onu
dikkate almaz.

**Mürekkebi Yeniden Renklendir, Yeniden Renklendir ile aynı şey değildir.**
Mürekkebi Yeniden Renklendir ve Kâğıdı Yeniden Renklendir çizim modlarıdır:
geçerli aracın dokunduğu her hücreyi yeniden renklendirirler - küçük bir
fırçayla birkaç hücre, dolu bir dikdörtgenin kapladığı her hücre - ve Yansıtma
uygulanır. Hücre aracı düğmesindeki **Yeniden Renklendir**, hangi araç seçili
olursa olsun imlecin altındaki tüm hücreyi yeniden renklendirir, fırça boyutunu
ve Yansıtmayı yok sayar. Aynı düğmedeki **Değiştir** de aynı şekilde çalışır ve
her hücrenin mürekkebiyle kâğıdını değiştirir. İkisi de siz kapatana kadar açık
kalır - Yok'u seçin, onu yeniden seçin, tuvale sağ tıklayın ya da bir araç veya
çizim modu seçin - ve açıkken durum çubuğu bunu söyler.

**Renkleri kopyala, Noktaları ters çevir ve Noktaları ve renkleri ters çevir**
aynı Hücre aracı düğmesindeki üç hücre aracıdır ve aynı şekilde çalışır: birini
seçin, sonra hücrelerin üzerine tıklayın veya sürükleyin. Her sürükleme tek
adımda geri alınır ve siz kapatana kadar araç açık kalır. **Renkleri kopyala**,
ilk tıklamanızın altındaki hücrenin gösterdiği renkleri alır ve üzerinden
sürüklediğiniz her hücreye verir; renk çubuğu değişmez. **Noktaları ters
çevir**, her tam hücrenin konmuş noktalarını siler, silinmişleri koyar ve
renkleri bırakır (boş bir hücreyi doldurur). **Noktaları ve renkleri ters
çevir** ayrıca mürekkep ile kâğıdı değiştirir, böylece her hücre aynı görünür;
içe aktarılmış bir resmi düzeltmek içindir, başka bir katmanın da çizdiği
hücreleri atlar ve ULAplus ile ULANext'te sunulmaz. Bir hücre aracı yalnızca
çalışabildiği ekran modlarında sunulur: Hücre aracı düğmesi yalnızca uygun
olanları listeler (hiçbiri uygun değilse gizlenir) ve Noktaları ters çevir,
noktaların 8'e 8 hücrelerde olduğu Timex Hi-res'te de çalışır.

**XOR / Üzerine ve XOR / Her geçiş** noktaları açmak yerine tersine çevirir ve
ikisi de hücreye seçilen renkleri verir. XOR / Üzerine her noktayı vuruş başına
bir kez çevirir; bu yüzden aynı vuruşta kendi çizginin üzerinden geri geçmek
başka bir şey değiştirmez. XOR / Her geçiş, vuruş bir noktanın üzerinden her
geçtiğinde onu çevirir: fırçanın bir sürüşü, yol boyunca kendi üzerine ne kadar
binerse binsin bir geçiştir; ama bir noktadan ayrılıp geri dönen vuruş onu
yeniden çevirir, bu yüzden bir sekiz kesiştiği yerde iptal olur. Şekiller,
eğriler, dolgular ve yazı her zaman tek bir geçiştir; bu yüzden bunlarda iki mod
aynı sonucu verir.

**Ters**, iki fare düğmesinin yaptığını değiştirir: sol düğme noktaları siler,
sağ düğme koyar, BASIC'in INVERSE 1'i gibi. Tercihler'den açılır, ya da Shift+I ile; durum çubuğu açıkken „Ters mod açık“ der. Mürekkebi
Yeniden Renklendir, Kâğıdı Yeniden Renklendir ve iki XOR modunda hiçbir şeyi
değiştirmez, çünkü orada iki düğme aynı işi yapar; durum çubuğu bunu söyler.
Metin ve damgalar harflerini ve şekillerini koymak yerine silerler, bir desen
noktalarını silme, boşluklarını nokta olarak koyar, dolgu da sol düğmeyle
kâğıtla, sağ düğmeyle mürekkeple doldurur. Silgi, Değiştir ve Yeniden Renklendir
bunu yok sayar. Oturumlar arasında hatırlanır ve çizim moduyla birlikte ön
ayarlarda saklanır.

**Renk çekirdeği.** Yuvarlak ve kare fırça, şekil dış çizgileri ve Bézier eğrisi
için Renk çekirdeği, kalın bir çizginin ne kadarının hücre renklerini aldığını
belirler. Bir çizgi her zaman tüm noktaları koyar. Renk çekirdeği 1 piksel ya da
4 piksel iken, yalnızca çizginin ortasının altındaki hücreler, ortasını izleyen
o genişlikte bir çizgi, renklerinizi alır; altındaki diğer hücreler noktaları
zaten sahip oldukları renklerle alır, böylece kalın bir çizgi daha az hücreyle
çakışır. Tüm çizgi, varsayılan, çizginin dokunduğu her hücreyi renklendirir.
Seçenek yalnızca hücre renkleri olan ekran modlarında görünür. Yansıtmada
yansıyan çizginin kendi çekirdeği vardır, XOR'da ise çekirdeğin dışındaki
hücreler renklerini korur.

### Paletler

İki mod ailesi renklerin kendisini değiştirmenize izin verir. ULAplus, on
altışarlık dört palet olarak düzenlenmiş 64 renk yazmacı sunar. Next modları her
biri dokuz bitlik 256 renk sunar.

Paletler dosyadır. Bir palet oluşturabilir, kaydedebilir ve başka bir resme
yükleyebilirsiniz; **Dosya > Palet yükle** ve **Dosya > Paleti kaydet** ile ya da
palet düzenleyicisinden. Yüklemek için düzenleyiciyi açmanız gerekmez, çünkü
palet genellikle çizime başlamadan önce yüklenir.

Bir dosya biçiminde palete yer varsa – 6976 baytlık `.scr`, `.nxi`, Timex
türü –, palet resmin içinde de taşınır.

**Palet yuvaları.** ULAplus paletinin ve Next paletinin her birinin dört yuvası vardır, Görüntü > Palet menüsünde (Yuva 1 – Yuva 4). Kullanılan yuva işaretlidir ve palet düzenleyici hangisini düzenlediğini söyler. Yeni bir belge Yuva 1'de başlar, diğer yuvalar siz kullanana kadar varsayılan paleti tutar. Başka bir yuva seçmek resmin gösterildiği renkleri değiştirir, resmin renk özniteliklerini asla değiştirmez. Her seçim tek bir geri alma adımıdır. Yuvalar bir projede ve otomatik yedekte saklanır, ama yalnızca bir yuvayı kullandıktan sonra; başka türde bir dosyadan açılan resim Yuva 1'de başlar ve diğer yuvalar paletinin kopyalarını tutar. .scr, .tap ve resim dışa aktarımları her zaman kullanılan yuvayı kullanır. Sabit paletli kiplerde (Standart ULA, Multicolor kipleri, GigaScreen ve Timex kipleri) yuva yoktur.

**Paleti ters çevir** (yalnızca ULAplus) dört CLUT'un her birinde mürekkep yarısını (0-7. girişler) kâğıt yarısıyla (8-15. girişler) değiştirir, tek bir geri alma adımında; iki kez yapmak paleti geri getirir. Bir ULAplus resmini aynı görünecek biçimde ters çevirmek için Paleti ters çevir'i, sonra Görüntü > Öznitelikler > Ters çevir'i kullanın. Kenarlık CLUT 0'ın kâğıt yarısını izler, bu yüzden o da renk değiştirir. Next kiplerinde palet çeviricisi yoktur, çünkü ULANext mürekkebi 8, kâğıdı 32 palet girişinde tutar.

**CLUT tuşları.** ULAplus kiplerinde Ctrl+Shift+1'den Ctrl+Shift+4'e kadar CLUT 0-3'ü seçer, renk çubuğundaki CLUT seçimi gibi. Diğer kiplerde durum çubuğu bunu söyler ve başka bir şey olmaz.

**Standart renkler.** Ayarlar > Tercihler içindeki Standart renkler bölümü, Standart, Multicolor, GigaScreen ve Timex kiplerinin gösterdiği 15 rengi değiştirmenizi sağlar. Parlak siyah her zaman siyahtır. Renkler gördüğünüzü ve resim dışa aktarımlarının (PNG, GIF, BMP, JPG) içerdiğini değiştirir; .scr veya .tap dosyalarının baytlarını asla değiştirmez, ve bir resmi içe aktarma hâlâ özgün Spectrum renklerine göre eşleştirir, böylece aynı fotoğraf her makinede aynı resmi verir. ULAplus ve Next paletleri ayrıdır. Tamam renkleri uygular, İptal hiçbir şey saklamaz, Standarda sıfırla özgün renkleri geri koyar. Projede değil, bu tarayıcıda saklanırlar. .pal yükle bir ZX Paintbrush standart renkler dosyasını (256 bayt) okur, .pal kaydet de bir tane yazar; renklerinizi başka bir tarayıcıya taşımanın yolu budur.

**Palet bantları.** Dosya > Paleti TAP olarak kaydet, ULAplus paletini 176 baytlık bir bant olarak yazar. Bir Spectrum'da `LOAD ""` ile yüklendiğinde 64 palet girişini ayarlar ve sonra banttaki sonraki dosyayı yükler; böylece bir palet bandı bir resim ya da oyun bandının önüne konabilir. Dosya > Palet yükle ve Dosya > Aç palet bantlarını okur: PixULA'nınkileri ve ZX Paintbrush'ınkileri. Bir palet bandı kullanılan palet yuvasına tek bir geri alma adımıyla girer ve açık dosya olmaz.

### GigaScreen

GigaScreen iki tam ekranı saklar ve onları saniyede elli kez sırayla gösterir.
Gözünüz her pikselin iki rengini birine karıştırır; böylece her ekranda bir
mürekkep ve bir kâğıt tutan bir hücre **dört** renk gösterebilir ve resmin
tamamı yaklaşık yüz renge ulaşabilir.

Hiçbir zaman tek bir ekrana çizmezsiniz. Her vuruş ikisine de yazar ve renk
çubuğu çiftler halinde çalışır:

- **A ekranı** ve **B ekranı**nın her birinin kendi mürekkep ve kâğıt örnekleri
  ve kendi **PARLAK** ayarı vardır. Yanıp sönme ikisi için tek bir ayardır.
- **Boya**, bu seçimlerden çıkan dört rengi tuvalin gösterdiği gibi karışık
  olarak gösterir: iki ekranda mürekkep, yalnızca A'da mürekkep, yalnızca B'de
  mürekkep ve iki ekranda kâğıt. Birini seçin, sol düğme onunla boyar. Sağ düğme
  her zaman iki ekrana da kâğıt boyar.
- İki ekran için aynı mürekkebi seçin; Boya'daki sol üst örnek karışmamış haliyle
  o renk olur – karışık görünmemesi gereken her şey böyle çizilir.

Damlalık tüm bunları geri alır: iki ekranın renklerini ve pikselin dördünden
hangisini gösterdiğini.

Görüntü düğmeleri yalnızca tuvalin ne gösterdiğini değiştirir, vuruşun nereye
gittiğini asla. **Ortalama**, gözün gerçek makinede gördüğüdür. **Titreme**,
donanımın yaptığı gibi iki ekranı her karede değiştirir. **A** ve **B** tek bir
ekranı gösterir. PNG olarak kaydettiğiniz veya dışa aktardığınız bir resim,
Titreme gösterilirken Ortalama'yı kullanır; çünkü durağan bir resim titreyemez.

GigaScreen'e geçmek resminizi iki ekrana da kopyalar; böylece öncekiyle aynı
görünür. Çıkmak A ekranını tutar ve B ekranını atar; B ekranı farklı bir şey
içeriyorsa önceden uyarılırsınız.

Aynı çalışma biçimi iki titreşimli mod daha için geçerlidir:

- **MultiGigaScreen 8×4, 8×2 ve 8×1** iki ekranı daha ince Multicolor
  hücrelerine yerleştirir; böylece dört renk 8×8 blok yerine 4, 2 veya tek bir
  satır için geçerlidir. Bunlar MultiArtist'in `.mg4`, `.mg2` ve `.mg1`
  dosyalarıdır.
- **Timex yüksek çözünürlük GigaScreen** 512×192'lik iki yüksek çözünürlüklü
  ekranı sırayla gösterir. Yüksek çözünürlükte hücre renkleri yoktur – her
  ekranın tüm resim için tek bir renk şeması vardır –, bu yüzden çubuk A ekranı
  için bir şema satırı, B ekranı için bir tane gösterir ve Boya ikisinin dört
  karışımını gösterir. Bunlar `.hrg` dosyalarıdır.

İki ekranlı modlar arasında geçiş, tek bir ekranı dönüştüren kurallarla iki
ekranı da korur.

### Öznitelikler

Görüntü menüsündeki Öznitelikler öğeleri hücre renklerini değiştirir, noktalar
yerinde kalır. Ters çevir her hücrede mürekkep ile kağıdı değiştirir ve parlaklık
ile yanıp sönmeyi korur. Sil, her hücreye geçerli mürekkep, kağıt, parlaklık ve
yanıp sönmeyi yazar; "mevcut olanı kullan" kutuları her hücrede zaten olanı korur.
Yatay çevir ve Dikey çevir hücre renklerini aynalar. Her komut seçimi (dokunduğu
tüm hücreleri) ya da hiçbir şey seçili değilse tüm resmi etkiler ve tek adımda
geri alınır. Öğeler, hücre renkleri olmayan kiplerde (Timex Hi-res, Layer 2,
LoRes), kendi renkleri olmayan bir damga yüzerken ve kilitli bir katmanda soluk görünür.

Değiştir... hücreleri renklerine göre bulur ve değiştirir. Bul, hangi hücrelerin eşleşeceğini belirler: her alan bir değer ya da Herhangi. Şununla değiştir, hücrelerin ne olacağını belirler: her alan bir değer ya da Koru. İletişim kutusu, Tamam'a basmadan önce kaç hücrenin değişeceğini gösterir ve Tamam tek adımda geri alınır. GigaScreen'de Ekran A ve Ekran B grupları vardır; ULAplus'ta CLUT 0-3, Parlaklık ve Yanıp sönme yerine geçer. İptal hiçbir şeyi değiştirmez.

### Noktalar

Görüntü menüsündeki Noktalar öğeleri noktaları değiştirir, renkleri hücrelerinde bırakır. Yatay çevir ve Dikey çevir noktaları çevirir. Noktaları ve renkleri ters çevir, her hücrenin mürekkep ve kağıdını da değiştirir, böylece resim aynı görünür. Hücre renkleri olmayan kipte sunulmaz (Layer 2, LoRes, Timex Hi-res) ve bir damga yüzerken gri görünür. ULAplus ve ULANext'te de sunulmaz, çünkü mürekkep ile kâğıdı değiştirmek resmin görünümünü değiştirirdi.

Dönüşüm panelindeki Kaydırma bölümünde Taşıma seçeneği neyin taşınacağını belirler. Noktalar ve renkler (varsayılan) tam hücreleri kağıtlarıyla birlikte taşır. Yalnızca noktalar noktaları seferinde bir piksel ya da bir hücre taşır. Yalnızca renkler hücre renklerini bir hücre kadar taşır. Yön tuşları çapraz yönleri de içerir. Bir damga yüzerken Taşıma gri görünür, çünkü kaydırma tüm damgayı taşır.

Bir seçim varken ok tuşları aynı Taşıma seçeneğini izler.

### Damgalar

Bir damga etkinken **Dönüştür** paneli onun nasıl yerleştirildiğini gösterir.

**Renkler**, Yalnızca pikseller ile Kendi renkleri arasında seçim yapar. Yalnızca pikseller damganın noktalarını her zamanki gibi öznitelik çubuğundaki renklerle koyar. Kendi renkleri damganın taşıdığı renkleri hücre hücre koyar: Harita Düzenleyici'den bir damga ya da hücre renkli bir kipte resimden kopyalanmış bir damga. Resimden kopyalanan damga Yalnızca pikseller olarak başlar, böylece yapıştırma eskisiyle aynen düşer. Kendi renkleri damgayı tam hücrelere oturtur, çizim kipini, renk çubuğunu ve XOR anahtarını yok sayar ve ölçeklenemez, döndürülemez, eğilemez, çevrilemez, ters çevrilemez ya da çizgilenemez; panel bunları soluklaştırır ve nedenini söyler. Yalnızca pikseller bir damganın şeklini değiştirmek taşıdığı renkleri atar. Ters hâlâ dolu ve boş noktaların ne yaptığını değiştirir. Damganın hücreleri geçerli ekran kipininkinden farklı boyuttaysa yalnızca Yalnızca pikseller mümkündür.

**Geçirgenlik** (yalnızca Kendi renkleri) damganın rengi yerine sayfada zaten olan rengin görünmesini sağlar. Mürekkep, Kâğıt, Parlaklık ve Yanıp sönme için ayrı birer kutu vardır. ULAplus'ta Parlaklık ve Yanıp sönme birlikte tek bir CLUT kutusu vardır. GigaScreen'de her kutu iki ekranı da kapsar.

**Boş noktalar** damganın boş noktalarının ne yapacağını belirler. Arka planı bırak altındaki resme dokunmaz (kendi renkleri olan damga, Kâğıt görünmedikçe altındaki kâğıdı yine de yeniden boyar). Arka planı sil onu da siler, damganın tüm dikdörtgeni üzerinde. Tersi olmayan çizim kipleri (XOR, Mürekkebi yeniden boya, Kâğıdı yeniden boya) ve damganın kendi XOR anahtarı boş noktalara dokunmaz ve panel bunu söyler. Boş noktalar, hücre renkleri olmayanlar dahil her ekran kipinde vardır.

**Yalnızca piksele dönüştür** damganın renklerini kalıcı olarak atar ve noktalarını tutar. Renkler içindeki Yalnızca pikseller seçimi onları korur, böylece geri dönülebilir. Her değişiklik tek bir geri alma adımıdır.

Kendi renkleri olan bir damga etkinken Görüntü > Öznitelikler komutları (Ters çevir, Sil, iki Çevir ve Değiştir...) resim yerine damganın hücreleri üzerinde çalışır; damga ister yüzüyor ister kenara konmuş olsun. Seçimi yok sayar ve damganın noktalarına asla dokunmaz; damganın kaplamadığı hücre olduğu gibi kalır. Çevirme damganın renk hücrelerini yansıtır, noktaları yerinde kalır. GigaScreen damgasında iki ekran için tek bir renk takımı vardır, bu yüzden Değiştir penceresi tek bir grup gösterir. Her komut tek bir geri alma adımıdır. Kendi renkleri olmayan bir damgada soluk kalırlar.
