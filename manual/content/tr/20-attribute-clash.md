## Öznitelik çakışması

Spectrum bir resmi iki ayrı parçada saklar.

Birincisi bir bit eşlemdir: 256×192 nokta, her biri bir bit, açık ya da kapalı.
İkincisi bir renk ızgarasıdır; bu noktaların her 8×8 bloğu için bir bayt – yatayda
32, dikeyde 24 bayt. Bu baytların her biri **mürekkebin** (açık noktaların) hangi
renk olacağını, **kâğıdın** (kapalı noktaların) hangi renk olacağını, çiftin
**parlak** olup olmadığını ve **yanıp sönüp** sönmeyeceğini söyler.

Yani resminizin şekli 256×192 çözünürlüktedir, rengi ise 32×24. Her 8×8 hücre
iki renk gösterebilir ve içindeki her nokta ya birinden ya da diğerindendir.

![Hücre ızgarası gösterilen büyütülmüş bir tuvalde kesişen iki çapraz çizgi. Mavi çizgi, kırmızı çizginin de geçtiği her hücrede kırmızıya dönüyor](img/attribute-clash.png)

*Kesişen bir mavi ve bir kırmızı çizgi, %800 büyütmede ve hücre ızgarası açıkken.
Kırmızı çizginin geçtiği her hücrede, o hücredeki mavi çizgi de kırmızıdır.
Kırmızı vuruş ikinci geldi ve tüm hücrenin mürekkep rengini ayarladı; mavi
vuruşun daha önce koyduğu noktalar da buna dahil.*

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

**Çizim modları.** Bir vuruş noktaları ve renkleri aynı anda değiştirmek zorunda
değildir. Renklere dokunmadan nokta koyabilir ya da tek bir noktaya dokunmadan
bir hücreyi yeniden renklendirebilirsiniz. Renk bölümü bunları listeler.

**Desen kitaplığı.** Çekirdeği, ölçülmüş mürekkep yoğunluklarına sahip bir karo
setidir; bir hücre tutamayacağı bir griye ihtiyaç duyduğunda başvurduğunuz şey
budur.

### Kuralların farklı olduğu yerler

Sonraki donanımlar bu kısıtı çeşitli şekillerde gevşetti ve PixULA hepsiyle
çalışabilir. Timex makineleri renk ızgarasını inceltti. ULAplus sabit on altı
rengi sizin seçtiğiniz bir paletle değiştirdi. GigaScreen iki resmi, ikisinde de
olmayan renkleri düşündürecek kadar hızlı değiştirir. ZX Spectrum Next, Layer 2
ve LoRes modlarında bu düzenden tamamen vazgeçer; orada her piksel kendi rengini
taşır.

Bir resmi bunlar arasında taşıyabilirsiniz – sonraki bölüme bakın.
