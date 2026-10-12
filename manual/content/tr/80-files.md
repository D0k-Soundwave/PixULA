## Dosyalar

Kaydedebileceğiniz iki farklı şey vardır ve hangisine uzandığınız önemlidir.

**Bir proje**, çalışmanızı bıraktığınız gibi saklar: her katmanı, paleti, ekran
modunu, araçlarınızı ve ayarlarını, referans resmini ve baktığınız yeri. Bu,
**Dosya > Projeyi kaydet** ile yazılan bir `.pixula` dosyasıdır ve bir resim
henüz sürerken kullanmanız gereken budur.

**Bir resim**, başka bir programın anladığı bir biçimde düzleştirilmiş tek bir
ekrandır – emülatör için `.scr`, birine göstermek için `.png`, gerçek donanımda
yüklemek için `.tap`. Bunları **Dosya > Resmi farklı kaydet** yazar. Yalnızca
resmi içerirler, başka bir şey değil; sonucu teslim ederken istediğiniz budur,
ama üzerinde çalışmaya devam etmek istiyorsanız değil.

### Resim içe aktarma

Bir fotoğraf veya başka bir resim (PNG, JPG, GIF) açıldığında üç dönüşüm yan yana gösterilir - Keskin, Yumuşak ve Düz - ve beğendiğinize tıklarsınız. Tonları noktalara çeviren Yumuşak dönüşümdür; önizlemelerin altındaki **Tarama** listesi bunun nasıl yapılacağını seçer: varsayılan içe aktarmanın kendi Floyd-Steinberg'idir ve liste ZX Paintbrush'ın diğer 30 yöntemini de sunar - eşikler, hata yayılımı, Bayer matrisleri, küme noktaları ve süperhücreler. Bir yöntem seçmek Yumuşak önizlemeye geçirir. Sıralı yöntemler öznitelik hücreleri boyunca devam eder, böylece desen tüm resimde akar; hata yayılımı her hücrenin içinde kalır, çünkü her hücrenin kendi iki rengi vardır. Layer 2 ve LoRes kiplerinde liste soluktur: bu kipler kendi renk taramalarını korur.

### Resmin bir bölümünü kaydetme

**Dosya > Seçimi farklı kaydet**, Resmi farklı kaydet ile aynı biçimleri listeler; her biri yalnızca seçim ona uyuyorsa açıktır. PNG, BMP ve JPEG her dikdörtgeni alır. ZXP, SEV, ZED, ASM, C, BIN ve ATR tam öznitelik hücrelerini alır: seçim önce hücrelere uydurulur ve durum çubuğu bunu söyler. ColorTiles tam 16x16 döşemeleri alır. Bir bütün ekranın dökümü olan biçimler (SCR, kasetler, MLT ve benzerleri) yalnızca seçim bütün ekran olduğunda açıktır. ASM, C, BIN ve ATR parçayı satır satır yazar: bit eşlemi satır başına bayt bloğu olarak yukarıdan aşağıya, öznitelikleri hücre başına bir bayt olarak; bunu klasik, multicolor ve ULAplus kiplerinde yaparlar. Serbest el veya elips seçimi sınırlayıcı dikdörtgenini kaydeder. Kapalı bir biçim, üzerine gelince nedenini söyler. Resmi farklı kaydet bütün resmi kaydeder ve seçimi yok sayar.

### Bir seçimden yeni resim

**Düzen > Seçimden yeni resim** seçimi resmin tamamına çevirir. Seçim önce tam hücrelere uydurulur. Bir şey yapmadan önce sorar ve Ctrl+Z eski resmi geri getirir. Bütün katmanlar korunur ve o bloğa kırpılır; blok sol üste taşınır, geri kalan boştur ve oradaki arka plan beyaz kağıttır. Ekran kipi aynı kalır ve resim adsız olur, bu yüzden sonraki Kaydet bir ad sorar.

### Otomatik kaydetme ve yedekler

PixULA çalışmanızı birkaç dakikada bir tarayıcının kendi depolamasına
kaydedebilir ve bir oturum kötü biterse size geri sunabilir. Sıklığı seçene kadar
kapalıdır: Tercihler'de, Genel altında **Otomatik kaydetme sıklığı (dakika, 0 =
kapalı)** değerini ayarlayın.

Diskte bir klasör de seçebilirsiniz; her otomatik kaydetme oraya numaralı bir
sürüm yazar – `picture V1.pixula`, `picture V2.pixula` vb. Numaralandırma her
seferinde klasörden okunur; böylece bir resmi yeniden açmak diziyi V1'den yeniden
başlatmak yerine sürdürür ve aynı resim üzerindeki iki oturum tek bir sürüm
dizisini paylaşır. Kaç tanesinin saklanacağını Tercihler'de ayarlayın;
varsayılan 20'dir.

Beklenmesi gereken bir şey var. Tarayıcı, önceki bir oturumda seçilmiş bir
klasörü sizin onayınız olmadan yeniden açmaz ve otomatik kaydetme zamanlayıcısı
sizin yerinize soramaz. Bu yüzden yeniden yüklemeden sonraki ilk yedek durur ve
sizi bekler. Tercihler'de bir **Yedeklemeyi sürdür** düğmesi vardır; ona basmak,
tarayıcının beklediği onaydır.

{{formats}}
