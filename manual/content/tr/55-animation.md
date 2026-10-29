## Animasyon

PixULA iki şekilde canlandırır. Bir **ekran animasyonu** kareden kareye bütün
resmi değiştirir. Bir **sprite animasyonu** resmin bir bloğunu, yürüyen bir
figürü ya da dalgalanan bir bayrağı değiştirir; resmin geri kalanı arkada
durur. İkisi de ekran modunun her kuralına uyar: bir kare tam öznitelik
hücrelerinden oluşur, bu yüzden bir hücrenin özniteliklerini asla bölmez.

### Animasyon başlatmak

![Animasyon menüsü](img/menu-animation.png)

![Yeni sprite animasyonu penceresi](img/dialog-new-sprite.png)

**Animasyon > Yeni ekran animasyonu** resmi 1. kare yapar. Her katman
animasyonlu olur: her karede kendi içeriği vardır.

**Animasyon > Yeni sprite animasyonu...** bir ad, genişlik ve yükseklik, bir
konum ve başlangıçta kaç kare olacağını sorar. Boyut modun tam hücrelerine
yukarı yuvarlanır ve iletişim kutusu neye dönüştüğünü söyler: 8x1 modunda
20 x 20, 24 x 20 olur. Seçimi kullan boyutu ve yeri bir seçimden alır.
Sprite'ı tıklayarak yerleştirmek için önce bloğu Seçim aracıyla seçin (Boyut:
Özel). **Seçimden yeni sprite animasyonu** ayrıca seçilen bloğu 1. kare olarak
sprite'ın kendi katmanına taşır. Penceresinin hemen dışındaki noktalı çizgi
nerede olduğunu gösterir.

Bir resimde birkaç animasyon olabilir; Animasyon panelinin üstündeki seçici
açık olanı belirler. Resimde animasyon varken ekran modu değişemez.

### Kareler

![Zıplayan bir topun altı karesiyle Animasyon paneli](img/animation-panel.png)

Animasyon paneli her kareyi numarası ve gecikmesiyle küçük bir resim olarak
gösterir. Gitmek için birine tıklayın ya da önceki ve sonraki kare için `,` ve
`.` tuşlarına basın. Gösterilen kareye her araçla, tıpkı durağan bir resimde
olduğu gibi çizersiniz: öznitelik çakışması, çizim modları, Ayna, damgalar,
Flash ve Geri al her zamanki gibi çalışır.

Ekle gösterilenin ardına boş bir kare, Çoğalt da onun bir kopyasını koyar;
Sil, Sol ve Sağ onu siler ve taşır. Gecikme, karenin ekranda kalma süresidir,
1/50 sn'lik Spectrum kareleri cinsinden; Tümüne uygula bu gecikmeyi her kareye
verir. Bir karenin bir parçasını sonrakine taşımak için onu kopyalayın
(**Animasyon > Kareden damga** bir sprite'ın penceresini kopyalar), sonraki
kareye gidin ve damgayı koyun. Başka bir karede yapılmış bir adımı geri almak
sizi o kareye geri götürür.

**Animasyon > Damgalardan kareler** Damgalar listesindeki her damgadan, damganın
bekletildiği yere konmuş yeni bir kare yapar; damgalar kalır.

### Animasyondaki katmanlar

![Animasyonlu ve ortak bir katman ile soğan zarının iki önizleme katmanını gösteren Katmanlar paneli](img/animation-layers.png)

Bir animasyon açıkken, Katmanlar panelinin her satırında Animasyonlu / Ortak
anahtarı vardır. Animasyonlu bir katmanın her karede kendi içeriği vardır;
ortak bir katman her karede aynı görünür, bir kez çizilen bir arka plan gibi.
Animasyonlu, katmanı her kareye kopyalar; Ortak, gösterilen kareyi tutar ve
önce sorar. Yeni katmanlar açık animasyona katılır; Aşağı birleştir, Seçilenleri
birleştir ve Düzleştir her karede çalışır.

### Oynatma

Oynat (Enter) açık animasyonu resmin üzerinde oynatır; bir sprite arka planı
üzerinde hareket eder, FLASH ve GigaScreen titremesi çalışmaya devam eder. İlk,
Önceki, Sonraki ve Son kareler arasında gezinir (devam etmek için Önceki ya da
Sonraki'yi basılı tutun), Durdur ise oynatmanın başladığı kareye döner. Resme
bir tıklama ya da Escape duraklatır. Tekrar kareleri döngüde, bir kez ya da
ileri-geri oynatır. Hız gecikmeleri değiştirmeden daha hızlı ya da yavaş
oynatır; Oynatılacak kareler animasyonun yalnızca bir bölümünü oynatır.

### Karelerin izini sürmek

Bir karenin altındaki **İz**, diğerlerini çizerken o kareyi soluk olarak,
Katmanlar panelinde bir önizleme katmanı olarak gösterir. **Soğan zarı**
anahtarı önceki ve sonraki kareyi aynı şekilde gösterir; kare değiştirdiğinizde
sizi izlerler. **Katman > Yeni önizleme katmanı** bunlardan birini tek başına
ekler.

Önizleme katmanı katman sisteminin kuralına uyar: kâğıt pikselleri ve boş
hücreleri saydamdır, üstündeki katmanların mürekkebi onu örter, altındakinin
üzerinde soluk görünür. Çizdiğiniz katmanın üstüne ya da altına koymak için onu
yukarı ya da aşağı taşıyın. Her birinin kendi saydamlığı, bir renk tonu (önceki
kareler kırmızı, sonrakiler mavi) ve göster ya da gizle seçeneği vardır; silmek
yalnızca önizlemeyi kaldırır. Önizleme asla resmin parçası değildir: üzerine
çizilmez, birleştirilmez ya da dışa aktarılmaz ve oynatırken gizlenir.

### Dışa aktarma

**Animasyon > Animasyonu dışa aktar**:

- **Numaralı ekranlar...** her kareyi sırayla numaralanmış (`walk_001.scr`,
  `walk_002.scr` ve böyle sürer) kendi Spectrum ekranı olarak, modun
  kaydedebildiği herhangi bir ekran biçiminde kaydeder. Her dosya, Resmi farklı
  kaydet'in o kare için yazdığının tıpatıp aynısıdır. Adı, ilk numarayı,
  basamak sayısını ve kareleri siz seçersiniz. Tarayıcı bir klasöre
  yazabiliyorsa bir klasör seçersiniz; yoksa ekranlar tek bir `.zip` olarak
  gelir.
- **Hareketli GIF** kareleri gecikmeleriyle, FLASH ve GigaScreen dahil oynatır.
- **PNG sprite sayfası** kareleri yan yana, satır başına 16 koyar.
- **SevenuP, tüm kareler** en fazla 32 kareyi tek bir `.sev` dosyasına yazar
  (standart mod). Birkaç kareli bir `.sev` açmak onlardan bir sprite animasyonu
  yapar.
- **Kaset** kare başına bir SCREEN$'ı bir `.tap` ya da `.tzx` dosyasına yazar.
  Ekranları içerir, onları oynatan bir programı değil.
- **Next sprite'ları** Layer 2 ve LoRes modlarındaki 16 x 16 bir sprite
  animasyonunu `.spr` sayfası olarak yazar.

Animasyonlar PixULA projelerine, kurtarma kaydına ve yedeklere kaydedilir.
