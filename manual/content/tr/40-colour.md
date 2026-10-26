## Renk

Klasik modlarda bir piksel için renk seçmezsiniz. Bütün bir hücrenin kullanacağı
iki rengi ve iki bayrağı seçersiniz.

- **MÜREKKEP** mürekkep piksellerinin rengidir.
- **KÂĞIT** kâğıt piksellerinin rengidir.
- **PARLAK** ikisini de daha açık sürümlerine yükseltir. Hücre başına tek bir
  Parlak bayrağı vardır; yani Mürekkep ve Kâğıt ya birlikte parlaktır ya da
  hiçbiri.
- **YANIP SÖNME** gerçek donanımda Mürekkep ile Kâğıdı saniyede yaklaşık iki kez
  yer değiştirir.

Sol fare düğmesi mürekkep pikselleri çizer. Sağ düğme kâğıt pikselleri çizer ve
sol düğmenin ayarlayacağı aynı dört özniteliği ayarlar. Kalemde yan düğme, sağ
düğmenin yaptığını yapar.

**Silgi** ikisinden de farklı bir şey yapar. Mürekkep piksellerini kâğıt
piksellerine çevirir ve hücrenin özniteliklerine dokunmaz; hücredeki son mürekkep
pikselini sildiğinde bile. Öznitelikleri de silmek için boş hücrenin üzerinden
yeni bir vuruşla bir kez daha geçin: Mürekkep, Kâğıt, Parlak ve Yanıp sönme
beyaz üzerine siyaha döner ve üst bir katmanda hücre yeniden saydam olur. İçinde
hâlâ mürekkep pikseli bulunan bir hücre, üzerinden kaç kez silgiyle geçerseniz
geçin özniteliklerini korur.
Silginin **Öznitelikler** seçeneği, hücre öznitelikleri olan ekran modlarında
görünür, bunu değiştirir: Geçerli olanı ayarla mürekkep piksellerini siler ve
hücreye çubuktaki öznitelikleri verir, ZX Paintbrush'ın silme aracı gibi; Koru, varsayılan, yukarıda
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
olursa olsun imlecin altındaki tüm hücreyi yeniden renklendirir, fırça boyutunu yok sayar. Aynı düğmedeki **Değiştir** de aynı şekilde çalışır ve
her hücrenin Mürekkebiyle Kâğıdını değiştirir. İkisi de siz kapatana kadar açık
kalır - Yok'u seçin, onu yeniden seçin, tuvale sağ tıklayın ya da bir araç veya
çizim modu seçin - ve açıkken durum çubuğu bunu söyler.

**Yalnızca öznitelikler** bu çizim modlarının üçüncüsüdür. Geçerli aracın
dokunduğu her hücreye Mürekkep, Kâğıt, Parlak ve Yanıp sönme özniteliklerini bir
kerede verir ve hiçbir piksel çizmez; ZX Paintbrush'ın piksel çizimi
kapalıykenki davranışı budur. Dört kısımdan **mevcudu kullan** konumunda olan
her biri her hücrede olduğu gibi kalır: Kâğıt mevcuttayken Mürekkebi Yeniden
Renklendir'in yaptığını, Mürekkep mevcuttayken Kâğıdı Yeniden Renklendir'in
yaptığını yapar. Onlardaki gibi iki düğme de aynı işi yapar ve yalnızca
hücreleri öznitelik taşıyan ekran modlarında sunulur.

**Öznitelikleri kopyala, Pikselleri ters çevir ve Pikselleri ve öznitelikleri
ters çevir** aynı Hücre aracı düğmesindeki üç hücre aracıdır ve aynı şekilde
çalışır: birini seçin, sonra hücrelerin üzerine tıklayın veya sürükleyin. Her
sürükleme tek adımda geri alınır ve siz kapatana kadar araç açık kalır.
**Öznitelikleri kopyala**, ilk tıklamanızın altındaki hücrenin gösterdiği
öznitelikleri alır ve üzerinden sürüklediğiniz her hücreye verir; renk çubuğu
değişmez. **Pikselleri ters çevir**, her tam hücrenin mürekkep piksellerini kâğıt
piksellerine, kâğıt piksellerini de mürekkebe çevirir ve öznitelikleri bırakır
(boş bir hücreyi doldurur). **Pikselleri ve öznitelikleri ters çevir** ayrıca
Mürekkep ile Kâğıdı değiştirir, böylece her hücre aynı görünür;
içe aktarılmış bir resmi düzeltmek içindir, başka bir katmanın da çizdiği
hücreleri atlar ve ULAplus ile ULANext'te sunulmaz. Bir hücre aracı yalnızca
çalışabildiği ekran modlarında sunulur: Hücre aracı düğmesi yalnızca uygun
olanları listeler (hiçbiri uygun değilse gizlenir) ve Pikselleri ters çevir,
piksellerin 8'e 8 hücrelerde olduğu Timex Hi-res'te de çalışır. Yansıtma açıkken her hücre aracı, Değiştir ve Yeniden Renklendir de dahil, dokunduğu her hücrenin ayna görüntüsünde de çalışır: ayna hücre kendi piksellerinde ve özniteliklerinde aynı değişikliği alır.

**XOR / Üzerine ve XOR / Her geçiş** mürekkep pikselleri çizmek yerine
pikselleri mürekkepten kâğıda ve kâğıttan mürekkebe çevirir ve ikisi de hücreye
seçilen öznitelikleri verir. XOR / Üzerine her pikseli vuruş başına bir kez
çevirir; bu yüzden aynı vuruşta kendi çizginin üzerinden geri geçmek
başka bir şey değiştirmez. XOR / Her geçiş, vuruş bir pikselin üzerinden her
geçtiğinde onu çevirir: fırçanın bir sürüşü, yol boyunca kendi üzerine ne kadar
binerse binsin bir geçiştir; ama bir pikselden ayrılıp geri dönen vuruş onu
yeniden çevirir, bu yüzden bir sekiz kesiştiği yerde iptal olur. Şekiller,
eğriler, dolgular ve yazı her zaman tek bir geçiştir; bu yüzden bunlarda iki mod
aynı sonucu verir.

**Ters**, iki fare düğmesinin yaptığını değiştirir: sol düğme kâğıt pikselleri,
sağ düğme mürekkep pikselleri çizer, BASIC'in INVERSE 1'i gibi. Tercihler'den açılır, ya da Shift+I ile; durum çubuğu açıkken „Ters mod açık“ der. Mürekkebi
Yeniden Renklendir, Kâğıdı Yeniden Renklendir, Yalnızca öznitelikler ve iki XOR
modunda hiçbir şeyi
değiştirmez, çünkü orada iki düğme aynı işi yapar; durum çubuğu bunu söyler.
Metin ve damgalar harflerini ve şekillerini mürekkep pikselleri yerine kâğıt
pikselleriyle çizer, bir desen mürekkep piksellerini kâğıt pikseli, kâğıt
piksellerini mürekkep olarak koyar, dolgu da sol düğmeyle kâğıt pikselleriyle,
sağ düğmeyle mürekkep pikselleriyle doldurur. Silgi, Değiştir ve Yeniden Renklendir
bunu yok sayar. Oturumlar arasında hatırlanır ve çizim moduyla birlikte ön
ayarlarda saklanır.

**Öznitelik çekirdeği.** Yuvarlak ve kare fırça, şekil dış çizgileri ve Bézier
eğrisi için Öznitelik çekirdeği, kalın bir çizginin ne kadarının hücre
özniteliklerini aldığını belirler. Bir çizgi her zaman tüm mürekkep piksellerini
çizer. Öznitelik çekirdeği 1 piksel ya da 4 piksel iken, yalnızca çizginin
ortasının altındaki hücreler, ortasını izleyen o genişlikte bir çizgi,
özniteliklerinizi alır; altındaki diğer hücreler mürekkep piksellerini zaten
sahip oldukları özniteliklerle alır, böylece kalın bir çizgi daha az hücreyle
çakışır. Tüm çizgi, varsayılan, çizginin dokunduğu her hücreye
özniteliklerinizi verir. Seçenek yalnızca hücre öznitelikleri olan ekran
modlarında görünür. Yansıtmada yansıyan çizginin kendi çekirdeği vardır, XOR'da
ise çekirdeğin dışındaki hücreler özniteliklerini korur.

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

**Palet yuvaları.** ULAplus paletinin ve Next paletinin her birinin dört yuvası vardır, Görüntü > Palet menüsünde (Yuva 1 – Yuva 4). Kullanılan yuva işaretlidir ve palet düzenleyici hangisini düzenlediğini söyler. Yeni bir belge Yuva 1'de başlar, diğer yuvalar siz kullanana kadar varsayılan paleti tutar. Başka bir yuva seçmek resmin gösterildiği renkleri değiştirir, resmin özniteliklerini asla değiştirmez. Her seçim tek bir geri alma adımıdır. Yuvalar bir projede ve otomatik yedekte saklanır, ama yalnızca bir yuvayı kullandıktan sonra; başka türde bir dosyadan açılan resim Yuva 1'de başlar ve diğer yuvalar paletinin kopyalarını tutar. .scr, .tap ve resim dışa aktarımları her zaman kullanılan yuvayı kullanır. Sabit paletli kiplerde (Standart ULA, Multicolor kipleri, GigaScreen ve Timex kipleri) yuva yoktur.

**Paleti ters çevir** (yalnızca ULAplus) dört CLUT'un her birinde Mürekkep yarısını (0-7. girişler) Kâğıt yarısıyla (8-15. girişler) değiştirir, tek bir geri alma adımında; iki kez yapmak paleti geri getirir. Bir ULAplus resmini aynı görünecek biçimde ters çevirmek için Paleti ters çevir'i, sonra Görüntü > Öznitelikler > Ters çevir'i kullanın. Kenarlık CLUT 0'ın Kâğıt yarısını izler, bu yüzden o da renk değiştirir. Next kiplerinde palet çeviricisi yoktur, çünkü ULANext Mürekkebi 8, Kâğıdı 32 palet girişinde tutar.

**CLUT tuşları.** ULAplus kiplerinde Ctrl+Shift+1'den Ctrl+Shift+4'e kadar CLUT 0-3'ü seçer, renk çubuğundaki CLUT seçimi gibi. Diğer kiplerde durum çubuğu bunu söyler ve başka bir şey olmaz.

**Standart renkler.** Ayarlar > Tercihler içindeki Standart renkler bölümü, Standart, Multicolor, GigaScreen ve Timex kiplerinin gösterdiği 15 rengi değiştirmenizi sağlar. Parlak siyah her zaman siyahtır. Renkler gördüğünüzü ve resim dışa aktarımlarının (PNG, GIF, BMP, JPG) içerdiğini değiştirir; .scr veya .tap dosyalarının baytlarını asla değiştirmez, ve bir resmi içe aktarma hâlâ özgün Spectrum renklerine göre eşleştirir, böylece aynı fotoğraf her makinede aynı resmi verir. ULAplus ve Next paletleri ayrıdır. Tamam renkleri uygular, İptal hiçbir şey saklamaz, Standarda sıfırla özgün renkleri geri koyar. Projede değil, bu tarayıcıda saklanırlar. .pal yükle bir ZX Paintbrush standart renkler dosyasını (256 bayt) okur, .pal kaydet de bir tane yazar; renklerinizi başka bir tarayıcıya taşımanın yolu budur.

**Palet bantları.** Dosya > Paleti TAP olarak kaydet, ULAplus paletini 176 baytlık bir bant olarak yazar. Bir Spectrum'da `LOAD ""` ile yüklendiğinde 64 palet girişini ayarlar ve sonra banttaki sonraki dosyayı yükler; böylece bir palet bandı bir resim ya da oyun bandının önüne konabilir. Dosya > Palet yükle ve Dosya > Aç palet bantlarını okur: PixULA'nınkileri ve ZX Paintbrush'ınkileri. Bir palet bandı kullanılan palet yuvasına tek bir geri alma adımıyla girer ve açık dosya olmaz.

### GigaScreen

GigaScreen iki tam ekranı saklar ve onları saniyede elli kez sırayla gösterir.
Gözünüz her pikselin iki rengini birine karıştırır; böylece her ekranda bir
Mürekkep ve bir Kâğıt tutan bir hücre **dört** renk gösterebilir ve resmin
tamamı yaklaşık yüz renge ulaşabilir.

Hiçbir zaman tek bir ekrana çizmezsiniz. Her vuruş ikisine de yazar ve renk
çubuğu çiftler halinde çalışır:

- **A ekranı** ve **B ekranı**nın her birinin kendi Mürekkep ve Kâğıt örnekleri
  ve kendi **PARLAK** ayarı vardır. Yanıp sönme ikisi için tek bir ayardır.
- **Boya**, bu seçimlerden çıkan dört rengi tuvalin gösterdiği gibi karışık
  olarak gösterir: iki ekranda Mürekkep, yalnızca A'da Mürekkep, yalnızca B'de
  Mürekkep ve iki ekranda Kâğıt. Birini seçin, sol düğme onunla boyar. Sağ düğme
  her zaman iki ekrana da Kâğıt boyar.
- İki ekran için aynı Mürekkebi seçin; Boya'daki sol üst örnek karışmamış haliyle
  o renk olur – karışık görünmemesi gereken her şey böyle çizilir.

Damlalık tüm bunları geri alır: iki ekranın özniteliklerini ve pikselin dördünden
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
  ekranı sırayla gösterir. Yüksek çözünürlükte hücre öznitelikleri yoktur – her
  ekranın tüm resim için tek bir renk şeması vardır –, bu yüzden çubuk A ekranı
  için bir şema satırı, B ekranı için bir tane gösterir ve Boya ikisinin dört
  karışımını gösterir. Bunlar `.hrg` dosyalarıdır.

İki ekranlı modlar arasında geçiş, tek bir ekranı dönüştüren kurallarla iki
ekranı da korur.

### Öznitelikler

Görüntü menüsündeki Öznitelikler öğeleri hücrelerin özniteliklerini değiştirir,
pikseller yerinde kalır. Ters çevir her hücrede Mürekkep ile Kâğıdı değiştirir ve
Parlak ile Yanıp sönmeyi korur. Sil, her hücreye geçerli Mürekkep, Kâğıt, Parlak
ve Yanıp sönmeyi yazar; "mevcut olanı kullan" kutuları her hücrede zaten olanı korur.
Yatay çevir ve Dikey çevir hücre özniteliklerini aynalar. Her komut seçimi (dokunduğu
tüm hücreleri) ya da hiçbir şey seçili değilse tüm resmi etkiler ve tek adımda
geri alınır. Öğeler, hücre öznitelikleri olmayan kiplerde (Timex Hi-res, Layer 2,
LoRes), kendi öznitelikleri olmayan bir damga yüzerken ve kilitli bir katmanda soluk görünür.

Değiştir... hücreleri özniteliklerine göre bulur ve değiştirir. Bul, hangi hücrelerin eşleşeceğini belirler: her alan bir değer ya da Herhangi. Şununla değiştir, hücrelerin ne olacağını belirler: her alan bir değer ya da Koru. İletişim kutusu, Tamam'a basmadan önce kaç hücrenin değişeceğini gösterir ve Tamam tek adımda geri alınır. GigaScreen'de Ekran A ve Ekran B grupları vardır; ULAplus'ta CLUT 0-3, Parlaklık ve Yanıp sönme yerine geçer. İptal hiçbir şeyi değiştirmez.

### Pikseller

Görüntü menüsündeki Pikseller öğeleri pikselleri değiştirir, öznitelikleri hücrelerinde bırakır. Yatay çevir ve Dikey çevir pikselleri çevirir. Pikselleri ve öznitelikleri ters çevir pikselleri ters çevirir ve her hücrenin Mürekkep ve Kâğıdını da değiştirir, böylece resim aynı görünür. Hücre öznitelikleri olmayan kipte sunulmaz (Layer 2, LoRes, Timex Hi-res) ve bir damga yüzerken gri görünür. ULAplus ve ULANext'te de sunulmaz, çünkü Mürekkep ile Kâğıdı değiştirmek resmin görünümünü değiştirirdi.

Dönüşüm panelindeki Kaydırma bölümünde Taşıma seçeneği neyin taşınacağını belirler. Pikseller ve öznitelikler (varsayılan) tam hücreleri Kâğıtlarıyla birlikte taşır. Yalnızca pikseller pikselleri seferinde bir piksel ya da bir hücre taşır. Yalnızca öznitelikler hücre özniteliklerini bir hücre kadar taşır. Yön tuşları çapraz yönleri de içerir. Bir damga yüzerken Taşıma gri görünür, çünkü kaydırma tüm damgayı taşır.

Bir seçim varken ok tuşları aynı Taşıma seçeneğini izler.

### Damgalar

Bir damga etkinken **Dönüştür** paneli onun nasıl yerleştirildiğini gösterir.

**Öznitelikler**, Yalnızca pikseller ile Kendi öznitelikleri arasında seçim yapar. Yalnızca pikseller damganın piksellerini her zamanki gibi öznitelik çubuğundaki özniteliklerle koyar. Kendi öznitelikleri damganın taşıdığı öznitelikleri hücre hücre koyar: Harita Düzenleyici'den bir damga ya da hücre öznitelikleri olan bir kipte resimden kopyalanmış bir damga. Resimden kopyalanan damga Yalnızca pikseller olarak başlar, böylece yapıştırma eskisiyle aynen düşer. Kendi öznitelikleri damgayı tam hücrelere oturtur, çizim kipini, renk çubuğunu ve XOR anahtarını yok sayar ve ölçeklenemez, döndürülemez, eğilemez, çevrilemez, ters çevrilemez ya da çizgilenemez; panel bunları soluklaştırır ve nedenini söyler. Yalnızca pikseller bir damganın şeklini değiştirmek taşıdığı öznitelikleri atar. Ters hâlâ mürekkep ve kâğıt piksellerinin ne yaptığını değiştirir. Damganın hücreleri geçerli ekran kipininkinden farklı boyuttaysa yalnızca Yalnızca pikseller mümkündür.

**Geçirgenlik** (yalnızca Kendi öznitelikleri) damganın özniteliği yerine sayfada zaten olan özniteliğin görünmesini sağlar. Mürekkep, Kâğıt, Parlaklık ve Yanıp sönme için ayrı birer kutu vardır. ULAplus'ta Parlaklık ve Yanıp sönme birlikte tek bir CLUT kutusu vardır. GigaScreen'de her kutu iki ekranı da kapsar.

**Kâğıt pikselleri** damganın kâğıt piksellerinin ne yapacağını belirler. Arka planı bırak altındaki resme dokunmaz (kendi öznitelikleri olan damga, Kâğıt görünmedikçe altındaki Kâğıdı yine de yeniden boyar). Arka planı sil altındaki resmi de kâğıt piksellerine çevirir, damganın tüm dikdörtgeni üzerinde. Tersi olmayan çizim kipleri (XOR, Mürekkebi Yeniden Renklendir, Kâğıdı Yeniden Renklendir) ve damganın kendi XOR anahtarı kâğıt piksellerine dokunmaz ve panel bunu söyler. Kâğıt pikselleri, hücre öznitelikleri olmayanlar dahil her ekran kipinde vardır.

**Yalnızca piksele dönüştür** damganın özniteliklerini kalıcı olarak atar ve piksellerini tutar. Öznitelikler içindeki Yalnızca pikseller seçimi onları korur, böylece geri dönülebilir. Her değişiklik tek bir geri alma adımıdır.

Kendi öznitelikleri olan bir damga etkinken Görüntü > Öznitelikler komutları (Ters çevir, Sil, iki Çevir ve Değiştir...) resim yerine damganın hücreleri üzerinde çalışır; damga ister yüzüyor ister kenara konmuş olsun. Seçimi yok sayar ve damganın piksellerine asla dokunmaz; damganın kaplamadığı hücre olduğu gibi kalır. Çevirme damganın öznitelik hücrelerini yansıtır, pikselleri yerinde kalır. GigaScreen damgasında iki ekran için tek bir öznitelik takımı vardır, bu yüzden Değiştir penceresi tek bir grup gösterir. Her komut tek bir geri alma adımıdır. Kendi öznitelikleri olmayan bir damgada soluk kalırlar.
