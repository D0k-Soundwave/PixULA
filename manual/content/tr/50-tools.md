## Araçlar

Araç çubuğu araçları resme ne yaptıklarına göre gruplar: önce mürekkep koyan her
şey, sonra seçim, sonra seçimin mümkün kıldığı kılavuz, sonra bitmiş çizimi
yerleştiren araçlar ve en sonda yalnızca görünümünüzü değiştirenler.

Çizim modu, ayna ve kılavuz buradaki her araca uygulanır; bu yüzden her aracın
seçeneklerinde görünmek yerine mod çubuğunda bir kez ayarlanır.

![Fırça ayarlarını gösteren araç seçenekleri paneli](img/tool-options-brush.png)

*Seçili aracın seçenekleri bu panelde görünür – burada fırçanınkiler.*

Fırçanın resmin üzerinde bir artı imleci yoktur. 2 ve üzeri boyutta, boyayacağı
alanın dış çizgisi imleçtir. 1 boyutunda imleç üç piksel genişliğinde küçük bir
artıdır ve ortasındaki nokta, fırçanın boyayacağı pikseldir ve boyayacağı
renktedir: PARLAK uygulanmış mürekkebiniz ya da mürekkep “mevcut rengi kullan”
olarak ayarlandığında hücrenin kendi mürekkebi. Çizerken nokta, az önce
boyadığınızı gösterir. Resmin çevresindeki gri alanın üzerinde normal imleç geri
gelir. Sprey, Solma, Desen ve Tarama da aynı şekilde çalışır.

Birçok seçenek yalnızca başka biriyle birlikte geçerlidir. Aşağıdaki tablolarda
her satırın hangi koşulda göründüğünü veren bir **Görünme koşulu** sütunu
vardır; “her zaman” işaretli satırlar diğer ayarlar ne olursa olsun oradadır.

**Noktalı şekiller.** Şekil listesinde noktalar koyarak çizilen bir Şekiller grubu vardır: Çoklu çizgi, Çokgen, Üçgen, Işınlar, Dik çizgi ve Paralel çizgi (L tuşu Şekil aracını seçer). Nokta eklemek için tıklayın ya da serbest iz için basıp sürükleyin. Çift tıklama veya Enter şekli bitirir; şekil resimde hâlâ değiştirebileceğiniz bir önizleme olarak kalır, bir Enter daha onu tek bir geri alma adımıyla çizer. Geri tuşu son noktayı kaldırır (serbest izi bütün olarak), Esc şekli çizmeden bırakır, başka bir yere tıklamak ya da başka bir araç seçmek onu çizer. Üçgen, Dik çizgi ve Paralel çizgi üçüncü noktada kendiliğinden biter: ilk çizgiyi sürükleyin, sonra son noktaya tıklayın. Dik çizgi, noktanızdan ilk çizgiye inen dikmenin ayağından ikinci bir çizgi ekler; Paralel çizgi, noktanız ortasında olacak biçimde ilk çizginin bir kopyasını ekler. Işınlar her sonraki noktayı ilkine bağlar. Çokgen ve Üçgen doldurulabilir. Şekiller her şekil gibi çizim kipini, Ters'i, “var olanı kullan” kutularını, yansıtmayı ve çizim kılavuzunu izler ve önizleme tam olarak çizileceği gibidir.

**Çizgi stili, Döndürme ve Yuvarlama.** Şekil aracı, Şekiller aracı ve Bézier eğrisi ortak bir Çizgi stilini paylaşır: Düz, Kesik, Noktalı, Çizgi-nokta, Çizgi-nokta-nokta ve Yok. Kesik stiller yalnızca bir piksel kalınlığındaki çizgide çizilir, bu yüzden 1'in üstünde soluktur; desen kontur boyunca, köşelerden de geçerek yürür ve bir şeklin her ışını ya da çizgisi kendi desenini başlatır. Yok kontur çizmez; yalnızca iç kısmı çizmek için Dolgu ile kullanın. Bézier eğrisinde Yok yoktur. Döndürme (-180 ile 180 derece arası, saat yönünde) dikdörtgeni, kareyi, yuvarlatılmış dikdörtgeni, elipsi ve paralelkenarı kutularının ortası çevresinde, yayı, daire dilimini, üçgeni, eşkenar dörtgeni ve düzgün çokgeni ise bastığınız nokta çevresinde döndürür. Yuvarlama yuvarlatılmış dikdörtgenin köşelerinin ne kadar yuvarlak olduğunu belirler; 0'da keskin köşe, 100'de yarım daire uçlar. Hâlâ düzenlediğiniz bir Bézier eğrisi başka bir araç seçtiğinizde çizilir, Esc onu bırakır. Bir şeklin ya da eğrinin önizlemesi yansıtılmış kopyaları gösterir ve bitmiş çizim gibi çizim kılavuzunun içinde kalır.

**Bir şekli düzenleme, taşıma, döndürme ve kopyalama.** Bitmiş bir Şekil ve bir Bézier eğrisi, siz çizene kadar resimde önizleme olarak kalır. Beklerken karelerden herhangi birini sürükleyerek biçimini değiştirebilir, şeklin kendisini sürükleyerek taşıyabilir, üstündeki yuvarlak topuzu sürükleyerek döndürebilir ve ok tuşlarıyla kaydırabilirsiniz (bir piksel, Shift ile ya da ızgaraya yapışma açıkken bir hücre). Ctrl+Z bu düzenlemelerin sonuncusunu, sonra şeklin kendisini, en son resmi geri alır. Enter, başka bir yere tıklamak, kaydetmek veya başka bir araç seçmek onu tek bir geri alma adımıyla çizer. Şekil aracındaki bir şekil normalde bıraktığınız anda çizilir; seçeneklerindeki **Düzenlenebilir bırak** kutusunu işaretlerseniz bir şekil gibi bekler, sürüklemenin her ucunda bir tutamakla. **Düzenle > Son şekli kopyala** (Shift+C) en son çizdiğiniz şeklin, biçimin veya eğrinin taşımaya, döndürmeye veya değiştirmeye hazır bir kopyasını açar; zaten çizilmiş birinin renklerini veya çizgi stilini değiştirmek için Ctrl+Z'ye, sonra Son şekli kopyala'ya basın. Bir şekil beklerken seçtiğiniz renkleri, çizgi stilini ve dolguyu izler, bitmiş çizim gibi.

**Desenli sprey.** Spreyin Dağılımını **Desen** yapın; nokta yerine daireler, kareler veya kısa çizgiler gibi küçük bütün figürler bırakır. Figürü, boyutunu ve dolu mu yoksa yalnızca kontur mu olacağını seçin; Akış, alanın ne kadarını kaplamaya çalışacaklarını belirler. Sprey alanının içine yalnızca bütün figürler konur, bu yüzden tek figüre yetmeyecek kadar küçük bir sprey hiçbir şey çizmez.

{{tools}}
