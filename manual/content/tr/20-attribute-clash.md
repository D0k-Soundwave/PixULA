## Öznitelik çakışması

Spectrum bir resmi iki ayrı parçada saklar.

Birincisi bir bit eşlemdir: 256×192 piksel, her biri bir bit, bir mürekkep pikseli
ya da bir kâğıt pikseli. İkincisi bir öznitelik ızgarasıdır; bu piksellerin her
8×8 bloğu için bir bayt – yatayda 32, dikeyde 24 bayt. Bu baytların her biri
**Mürekkebin** (mürekkep piksellerinin rengi) hangi renk olacağını, **Kâğıdın**
(kâğıt piksellerinin rengi) hangi renk olacağını, çiftin **Parlak** olup
olmadığını ve **Yanıp sönme** yapıp yapmayacağını söyler.

Yani resminizin şekli 256×192 çözünürlüktedir, rengi ise 32×24. Her 8×8 hücre
iki renk gösterebilir ve içindeki her piksel ya birinden ya da diğerindendir.

![Hücre ızgarası gösterilen büyütülmüş bir tuvalde kesişen iki çapraz çizgi. Mavi çizgi, kırmızı çizginin de geçtiği her hücrede kırmızıya dönüyor](img/attribute-clash.png)

*Kesişen bir mavi ve bir kırmızı çizgi, %800 büyütmede ve hücre ızgarası açıkken.
Kırmızı çizginin geçtiği her hücrede, o hücredeki mavi çizgi de kırmızıdır.
Kırmızı vuruş ikinci geldi ve tüm hücrenin Mürekkebini ayarladı; mavi
vuruşun daha önce koyduğu mürekkep pikselleri de buna dahil.*

“Öznitelik çakışması” (*attribute clash*) budur. Bir hücrenin bir bölümüne çizmek
içindeki her şeyin rengini değiştirir ve bunu kapatan bir ayar yoktur – donanım
böyle çalışır.

### Onunla çalışmak

Spectrum sanatçılarının çoğu renk alanlarını ayrıntılardan önce planlar ve resmi,
renk sınırları hücre sınırlarına denk gelecek şekilde düzenler. Bir hücre
tutamayacağı bir tona ihtiyaç duyduğunda titreme (dithering) kullanılır: iki
renk, gözün onları karıştıracağı kadar ince biçimde iç içe geçirilir.

PixULA bu konuda üç şekilde yardım eder.

**Hücre ızgarası.** Yakınlaştırma denetimlerinin yanında açın; bir renk
değişikliğinin nerede bedava, nerede size pahalıya mal olacağını tam olarak
görürsünüz.

**Çizim modları.** Bir vuruş pikselleri ve öznitelikleri aynı anda değiştirmek
zorunda değildir. Özniteliklere dokunmadan mürekkep pikselleri çizebilir ya da
tek bir piksele dokunmadan bir hücreyi yeniden renklendirebilirsiniz. Renk bölümü bunları listeler.

**Desen kitaplığı.** Çekirdeği, ölçülmüş mürekkep pikseli yoğunluklarına sahip bir karo
setidir; bir hücre tutamayacağı bir griye ihtiyaç duyduğunda başvurduğunuz şey
budur.

### Pikselleri görmek

Görünüm menüsündeki üç anahtar, resmi değiştirmeden ekranın gösterdiğini
değiştirir. **Öznitelikler kapalı** mürekkep piksellerini siyah, kâğıt piksellerini
beyaz gösterir; böylece hangi piksellerin gerçekten mürekkep olduğunu görebilirsiniz. **Renk ızgarası**
aynısını yapar ve ayrıca hücreleri satranç tahtası gibi boyar; hücre sınırları
kolayca görülür; o ve Öznitelikler kapalı birbirini kapatır. **Yanıp sönmeyi durdur**
yanıp sönen her hücreyi normal renklerinde tutar. Hiçbiri resme, geri almaya ya
da dışa aktarmaya dokunmaz: kaydedilmiş bir resim, açık da olsalar kapalı da
olsalar aynı görünür. Tarayıcı bunları hatırlar ve geçerli ekran modunda
çalışamayan bir anahtar gri görünür – nedenini görmek için üzerine gelin.
GigaScreen ve MultiGiga'da Öznitelikler kapalı dört gri düzey gösterir: iki
ekranda da mürekkep pikseli olmayan yerde beyaz, yalnızca A ekranındaki bir
mürekkep pikseli için açık gri, yalnızca
B ekranı için daha koyu gri ve ikisi için siyah.

### İşaretçiyi okumak

Resmin altındaki şerit ve durum çubuğu işaretçinin nerede olduğunu söyler.
**Tercihler**'de *İşaretçi göstergesi şunu gösterir* seçeneği işaretçinin
altındaki özniteliği ekler (onluk ve onaltılık sayısı, sonra Mürekkep, Kâğıt,
Parlak ve Yanıp sönme; ULAplus'ta CLUT; GigaScreen'de iki ekran) ve pikselin
baytının ve öznitelik baytının bellek adresini. Adresler gerçek makinenin sabit
düzeni olduğu yerde vardır: Standart ULA ve ULAplus (ekran dosyası $4000'den,
öznitelikler $5800'den), Timex hi-colour (öznitelikler $6000'deki ikinci ekran
dosyasında), Timex hi-res (çift bayt sütunları $4000'de, tek olanlar $6000'de)
ve GigaScreen (A ekranı standart gibi, B ekranı $C000'deki 7. bankta; hangi
ekranın hangi bankaya ait olduğu bir uzlaşmadır). Diğer modlar adresleri
olmadığını söyler.

*Y şuradan sayılır* alta ayarlanabilir; böylece gösterge BASIC PLOT gibi okunur:
0,0 sol alt köşedir ve Y 0'dan 175'e gider. Bu yalnızca 256'ya 192'lik resmin
üst 176 satırında vardır; altında ve diğer ekranlarda gösterge tire gösterir.
Yalnızca göstergeyi değiştirir.

Görünüm menüsündeki **Özel ızgara...** istenen X ve Y adımıyla, ayrı ayrı
ayarlanarak bir ızgara çizer; **Özel ızgarayı göster** onu açıp kapatır. Ekranda
dört pikselden yakın çizgiler, yakınlaştırana kadar çizilmez. Açtığınız
ızgaralar programı bir sonraki açışınızda geri gelir. Tercihler'de *Izgara
renkleri* her ızgaranın rengini belirler; *Tema rengi* işaretli kalırsa ızgara
temayı izler.

### Kuralların farklı olduğu yerler

Sonraki donanımlar bu kısıtı çeşitli şekillerde gevşetti ve PixULA hepsiyle
çalışabilir. Timex makineleri öznitelik ızgarasını inceltti. ULAplus sabit on altı
rengi sizin seçtiğiniz bir paletle değiştirdi. GigaScreen iki resmi, ikisinde de
olmayan renkleri düşündürecek kadar hızlı değiştirir. ZX Spectrum Next, Layer 2
ve LoRes modlarında bu düzenden tamamen vazgeçer; orada her piksel kendi rengini
taşır.

Bir resmi bunlar arasında taşıyabilirsiniz – sonraki bölüme bakın.
