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

{{draw-modes}}

Fırçanın tüm biçimleri, doldurma, şekiller, Bézier eğrisi, yazı, **Damgalar**
panelindeki damgalar ve degradenin sol düğmesi çizim moduna uyar. Silgi,
damlalık, bir seçimi taşıma, yapıştırma ve silme, **Dönüşüm** paneli, **Yalnızca
öznitelikleri doldur** seçeneği ile Değiştir ve Yeniden renklendir düğmeleri onu
dikkate almaz.

**Mürekkebi yeniden renklendir, Yeniden renklendir ile aynı şey değildir.**
Mürekkebi yeniden renklendir ve Kâğıdı yeniden renklendir çizim modlarıdır: o
anki aracın dokunduğu her hücreyi yeniden renklendirirler (küçük bir fırçayla
birkaç hücreyi, dolu bir dikdörtgenle kapladığı tüm hücreleri) ve Ayna da
geçerlidir. Ayırıcının hemen ardındaki **Yeniden renklendir**, hangi araç seçili
olursa olsun, fırça boyutundan ve Aynadan bağımsız olarak işaretçinin altındaki
hücrenin tamamını yeniden renklendirir. Yanındaki **Değiştir** de aynı şekilde
çalışır ve her hücrenin mürekkebiyle kâğıdını yer değiştirir. İkisi de yeniden
tıklanana ya da bir araç veya çizim modu seçilene kadar açık kalır ve açık
olduğu sürece durum çubuğu bunu gösterir.

**XOR / Üzerine ve XOR / Her geçiş** noktaları açmak yerine tersine çevirir ve
ikisi de hücreye seçilen renkleri verir. XOR / Üzerine her noktayı vuruş başına
bir kez çevirir; bu yüzden aynı vuruşta kendi çizginin üzerinden geri geçmek
başka bir şey değiştirmez. XOR / Her geçiş, vuruş bir noktanın üzerinden her
geçtiğinde onu çevirir: fırçanın bir sürüşü, yol boyunca kendi üzerine ne kadar
binerse binsin bir geçiştir; ama bir noktadan ayrılıp geri dönen vuruş onu
yeniden çevirir, bu yüzden bir sekiz kesiştiği yerde iptal olur. Şekiller,
eğriler, dolgular ve yazı her zaman tek bir geçiştir; bu yüzden bunlarda iki mod
aynı sonucu verir.

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
