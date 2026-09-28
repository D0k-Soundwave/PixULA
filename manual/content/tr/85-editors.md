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
