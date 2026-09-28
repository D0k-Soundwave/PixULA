## İş akışları

Başından sonuna bazı yaygın işler.

### İlk resminiz

1. `PixULA.html` dosyasını açın. Boş, 256×192'lik bir ekranla Standart ULA'da
   başlarsınız.
2. Rengin saklandığı 8×8 blokları görmek için yakınlaştırma denetimlerinin
   yanındaki hücre ızgarasını açın.
3. Renk çubuğundan ya da 1–8 tuşlarıyla bir mürekkep rengi, bir örneğe sağ
   tıklayarak da bir kâğıt rengi seçin.
4. **Fırça** ile çizin. Sol düğme mürekkep, sağ düğme kâğıt içindir.
5. `+` ve `-` ile yakınlaştırın. Hareket etmek için boşluk çubuğunu basılı
   tutup sürükleyin ya da **Görünümü kaydır** aracını kullanın.
6. `Ctrl+Z` geri alır. `Ctrl+S`, resmin yanı sıra katmanlarınızı ve
   ayarlarınızı da saklayan bir `.pixula` projesi kaydeder.

Renk alanlarını ayrıntılardan önce yerleştirmek genellikle iş tasarrufu sağlar;
çünkü bir hücre sınırına denk gelmeyen bir renk sınırı, zaten oturttuğunuz
renkleri değiştirmeye devam eder.

### Bir fotoğrafın üzerinden geçmek

1. **Referans** panelini açın ve fotoğrafınızı yükleyin. Ayarladığınız
   opaklık, konum ve ölçekle çiziminizin arkasında durur ve kaydettiğiniz resmin
   asla parçası olmaz.
2. Normal bir katmanda üzerine çizin.
3. Referans bir gün orijinalden daha bulanık görünürse panel bunu söyler ve bir
   **Fotoğrafı bul** düğmesi sunar. PixULA diskteki dosyaya bağlanır; fotoğraf
   taşınırsa ondan yalnızca küçük bir önizleme kalır.

### Bir fotoğrafı dönüştürmek

Dönüştürmeyi PixULA'ya bırakmak için:

1. **Dosya > Yükle** ile bir `.png`, `.jpg` veya `.gif` seçin.
2. İçe aktarma penceresi üç dönüşümü yan yana gösterir: Keskin, Yumuşak ve Düz.
   Hangisinin en iyi göründüğü tamamen fotoğrafa bağlıdır; bu yüzden her
   seferinde üçünü de karşılaştırmaya değer.
3. Önizleme iyi okunana kadar parlaklığı, kontrastı ve ölçeklemeyi ayarlayın,
   sonra kabul edin.

ULAplus ve Next modlarında palet resminizden oluşturulur; yani on altı ULA
rengiyle sınırlı kalmazsınız. Bu genellikle büyük fark yaratır.

### Yazı tipi yapmak

1. **Dosya > Yazı Tipi Düzenleyici**.
2. ZX ROM yazı tipiyle başlayın ya da bir `.ch8` veya `.chr` seti içe aktarın.
3. Bir karakter seçip düzenleyin. 4, 6 ve 8 piksel genişlikler vardır, ama
   daraltmak sağdaki sütunları kalıcı olarak atar; deneme yapıyorsanız dardan
   yukarı çıkın.
4. Kitaplığınıza eklemek için yazı tipine bir ad verin.
5. **Yazı** aracını seçin. Yazı tipiniz listesinde ROM yazı tipinin yanında
   görünür. Yazın, metni yerleştirin ve kalıcı yapmadan önce ölçekleyin veya
   döndürün – ilerledikçe gliflerden yeniden çizilir, bu yüzden her boyutta
   keskin kalır.

### Karolardan harita kurmak

1. Karo olarak kullanmak istediğiniz hücreleri tuvale çizin.
2. **Dosya > Harita Düzenleyici** ile onları karo setine yakalayın.
3. Harita boyutunu ayarlayıp boyayın. Sol düğme bir karo koyar, sağ düğme siler
   ve doldurma, aynı karolardan oluşan bitişik bir alanı değiştirir.
4. Çalışmaya devam etmek için `.zxtm` olarak ya da bir programda kullanmak için
   assembly, C veya ham ikili olarak dışa aktarın.

### ZX Spectrum Next için çizmek

1. Görüntü menüsünden bir Next modu seçin – 256, 320 veya 640 genişliğinde
   Layer 2 ya da LoRes modlarından biri.
2. Bu modlarda öznitelik çakışması yoktur; her piksel kendi palet dizinini
   taşır. Yönettiğiniz şey, **Görüntü > Paleti düzenle** ile düzenlenen ve
   `.pal` ya da `.npl` olarak kaydedilen 256 dokuz bitlik renkten oluşan bir
   palettir.
3. Resmi, paleti içinde taşıyan `.nxi` olarak ya da ham bit eşlem için `.sl2`
   olarak kaydedin.
4. Sprite'lar için **Dosya > Sprite Düzenleyici**'yi kullanın ve sayfayı `.spr`
   olarak kaydedin.

Klasik bir resmi bir Next moduna ve geri dönüştürebilirsiniz. Geri dönmek her
hücreyi yeniden iki renge sığdırmak demektir; o yönde ayrıntı kaybı bekleyin.
PixULA bunu yapmadan önce size söyler.

### Bir resmi gerçek donanıma taşımak

- **Bir emülatör için** `.scr` kaydedin. Bu, Spectrum ekran belleğinin ham
  içeriğidir ve her emülatör onu okur. Tam boyut ekran moduna bağlıdır – ekran
  modları bölümündeki tablo her biri için verir.
- **Gerçek bir makine için** `.tap` veya `.tzx` kaydedin. Ekranınızı zaten başka
  dosyalar içeren bir kasete eklemek için **Dosya > Kaset blokları**'nı
  kullanın.
- **Spectrum'u olmayan birine göstermek için** `.png` kaydedin.
