## Düzenleyiciler

PixULA'nın ürettiği dört şey resim değildir ve her birinin Dosya menüsünde
kendi penceresi vardır.

### Yazı tipi düzenleyici

Bir Spectrum karakter seti 96 ya da 256 glif içerir; her biri satır baytlarından
oluşan bir yığın olarak saklanır. Bu düzenleyici onları glif glif düzenler.

![Bir yanda glif ızgarası, diğer yanda düzenlenen tek bir karakterle yazı tipi düzenleyici](img/dialog-font-editor.png)

*Soldaki ızgaradan bir karakter seçin ve sağda düzenleyin.*

Glifler hücre yüksekliğinde 4, 6 veya 8 piksel genişliğinde olabilir. Bir yazı
tipini daraltmak sağdaki sütunları kalıcı olarak atar; genişlikleri
deniyorsanız dardan genişe doğru çalışın.

ZX ROM yazı tipiyle başlayabilir, tuvalden bir glif yakalayabilir ya da başka bir
Spectrum aracından `.ch4`, `.ch6`, `.ch8`, `.chr` veya `.chx` karakter seti
yükleyebilirsiniz. Bir yazı tipine ad vermek onu kitaplığınıza ekler ve Yazı
aracı onu yerleşik ROM yazı tipinin yanında sunar.

**Büyük yazı tipleri.** Yeni büyük yazı tipi... ZX-Editor Second Edition'ın kullandığı türden bir CHX büyük yazı tipi takımı oluşturur: her karakter 8, 16, 24 veya 32 piksel genişliğinde ve yüksekliğindedir (genişlik ve yükseklik ayrı seçilir) ve düzenleyici genişlik listesinin yerinde boyutu gösterir. Metin aracının kullandığı aynı listeden herhangi bir yazı tipini, harflerin karakter yüksekliğinin ne kadarını kaplayacağını (yüzde olarak) ve solda, ortada ya da sağda durup durmayacağını seçmek için Bir yazı tipiyle doldur kutusunu işaretleyin. Orantılı kutusunu işaretlerseniz her harf yalnızca gereken genişlikte, tam 8 piksellik sütunlar halinde kaydedilir; böylece i, W'dan daha az yer kaplar; Boşluk karakteri her zaman en az bir sütun korur. Yazı tipinden doldur... aynı şeyi elinizdeki büyük bir yazı tipine tek adımda yapar. Büyük bir yazı tipi yalnızca `.chx` olarak kaydedilebilir (diğer biçimler ile birleştirici, C ve ikili listeler 8'e 8 karakter taşır), tuvalden hücre yakalayamaz ve Metin aracı onu henüz sunmaz. Büyük bir `.chx` açmak her karakteri kendi boyutunda tutar ve dosyanın atladığı bir karakter yeniden kaydederken de atlanmış kalır. Birkaç 8'e 8 bloktan oluşan bir karakterin dosyada nasıl dizildiği biçimin yayımlanmış tanımını izler ve ZX Paintbrush'ın kendisinin kaydettiği bir dosyayla denetlenmemiştir; bu yüzden burada yapılmış büyük bir yazı tipine güvenmeden önce onu ZX Paintbrush'ta açın.

**Gölgeleme ve geri alma.** Karakterleri tam sayıda 8 piksellik sütun genişliğinde olan bir yazı tipinde, dört Gölgeleme düğmesi düzenlediğiniz karakterin solunda veya sağında bir seferde bir sütunu gölgeler ya da gölgesini kaldırır. Gölgeli sütun taralı çizilir ve kaydedilmez: bir `.chx` dosyası o karakteri daha dar tutar, baştan sona gölgeli bir karakter ise dosyadan çıkarılır. Gölgenin altındaki noktalar düzenleyicide korunur, bu yüzden gölgeyi kaldırmak onları geri getirir, ama dosyada yer almazlar. Hepsini sığacak şekilde gölgele bunu tüm karakterler için bir anda yapar: noktaların iki yanındaki boş sütunları gölgeler, Boşluğa bir sütun bırakır ve diğer boş karakterleri dışarıda bırakır. Boşluk karakteri her zaman en az bir sütun korur, çünkü bir `.chx` dosyası onu içermek zorundadır. Bir `.chx` dışa aktarımından sonra durum satırı kaç karakterin daha dar kaydedildiğini, kaçının dışarıda bırakıldığını ve kaçının gölgelemesi altında nokta olduğunu söyler. Yazı tipi düzenleyicisinde ayrıca Geri al ve Yinele vardır (iki düğme ya da Ctrl+Z ve Ctrl+Y): düzenleme yüzeyindeki bir fırça darbesi bir adımdır; her düğme, Yeni büyük yazı tipi, Yazı tipinden doldur, ROM yazı tipini yükle veya bir içe aktarma da öyle. Yazı tipi adı kutusuna yazmak buna dahil değildir.

**Tüm karakterler.** Tüm karakterler düğmesi tek karakterlik düzenleyiciyi tüm yazı tipinin haritasıyla değiştirir: tüm karakterler yan yana, satırda 16 tane; üzerine aynı Fırça, Silgi, Çizgi ve Doldur ile çizersiniz, böylece bir fırça darbesi bir karakterden sonrakine geçebilir. Bir darbe bir değişiklik ve bir geri alma adımıdır, Doldur ise tıkladığınız karakterin içinde kalır. Gölgele aracı tıkladığınız 8 piksellik sütunu, karakterinin yakın kenarından başlayarak gölgeler veya gölgesini kaldırır; gölgeli sütunlar taralıdır. Taşı aracı haritayı sürükler, parmakla kaydırmanın yolu budur, çünkü harita aksi halde her dokunuşu çizim için ayırır. Eksi, Sığdır ve artı düğmeleri yakınlaştırmayı tam adımlarla değiştirir. Haritada ve karakter ızgarasında ok tuşları, Home ve End karakterden karaktere geçer ve bir karakteri yazmak onu seçer. Pikselleri yalnızca klavyeyle çizmek mümkün değildir.

### Harita düzenleyici

Harita bir karo ızgarasıdır; bir karo, 8×8'lik bir hücredir – sekiz bit eşlem
baytı ve bir öznitelik baytı. Haritalar tek bir ekrandan büyük bir oyun alanı
kurmanızı sağlar.

![Karo paleti ve kaydırılabilir bir harita alanıyla harita düzenleyici](img/dialog-map-editor.png)

*Solda karolar, sağda harita.*

Sol düğmeyle boyayın, sağ düğmeyle silin ya da aynı karolardan oluşan bitişik bir
alanı doldurma ile değiştirin. Karolar geçerli desen ve renklerden ya da
doğrudan tuvalden gelir. Bir haritayı tuvale geri işleyebilirsiniz ve tek bir
geri alma hepsini geri alır.

Çalışmaya devam etmek için `.zxtm` olarak kaydedin – PixULA'nın kendi biçimidir
ve her şeyi korur – ya da `.zxm` olarak veya bir programa eklemek için assembly,
C ya da ham ikili olarak.

### Sprite düzenleyici

Next sprite'ları piksel başına bir palet diziniyle 16×16 pikseldir ve bir sayfa
en fazla 64 tane tutar.

![Bir sprite sayfası ve düzenleme ızgarasıyla sprite düzenleyici](img/dialog-sprite-editor.png)

*Bir yanda sayfa, diğer yanda çizdiğiniz sprite.*

Sprite sayfaları resminizin içinde değil, `.spr` dosyalarında tutulur; bu yüzden
sayfayı ayrıca kaydedin. Dizinli modlarda tuvalden bir sprite yakalayabilir ve
tuvale bir tane damgalayabilirsiniz.

### Palet düzenleyici

Düzenlenebilir paleti olan modlarda **Görüntü > Paleti düzenle**. ULAplus'ı on
altışarlık dört palet, Next paletini ise dokuz bitlik renk satırları olarak
gösterir. Seçtiğiniz her renk, donanımın gerçekten saklayabileceği en yakın
değere yuvarlanır; yani gördüğünüz, makinenin göstereceğidir.

Her değişiklik ayrı bir geri alma adımıdır. Paletler bu pencereyi açmadan da
yüklenip kaydedilebilir – renk bölümüne bakın.

### Kaset blokları

**Dosya > Kaset blokları** bir `.tap` veya `.tzx` dosyasını açar ve içindekileri
listeler. Birkaç ekran içeren bir kasetten tek bir ekranı yüklemek ya da geçerli
resminizi yeni bir blok olarak kasete ekleyip kaseti yeniden kaydetmek için
kullanın.

Dokunmadığınız bloklar bayt bayt geri yazılır; böylece başkasının kasetine bir
ekran eklemek geri kalanını tam olarak olduğu gibi bırakır.
