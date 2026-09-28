## Başlarken

PixULA, ZX Spectrum ve ZX Spectrum Next için bir piksel sanatı düzenleyicisidir.
Tarayıcıda, kendi diskinizdeki bir klasörden çalışır; kurulum, sunucu ya da
internet bağlantısı gerekmez.

Klasörü istediğiniz yere açın ve `PixULA.html` dosyasına çift tıklayın. Kurulumun
tamamı bu. Siz istemedikçe o klasörün dışına hiçbir şey yazılmaz ve çizdiğiniz
hiçbir şey bilgisayarınızdan çıkmaz.

### Önce bilinmesi gereken

Spectrum her rengi her yere koyamaz. Resminizi piksel başına bir bitlik bir bit
eşlem olarak saklar; bunun üzerine ayrı ve çok daha kaba bir renk ızgarası
biner ve her 8×8 bloğun içinde yalnızca iki renk kullanılabilir. Buradaki her
aracın davranışını bu tek gerçek belirler ve sonraki bölüm bunu anlatır.

### Yolunuzu bulmak

![PixULA penceresi: menü çubuğu, mod çubuğu, araç çubuğu, renk çubuğu, tuval, paneller ve durum çubuğu](img/workspace.png)

*Pencerenin tamamı.*

- **Menü çubuğu** en üstte: dosyalar, düzenleme, görünüm, katmanlar, resmin
  kendisi, ayarlar ve yardım.
- **Mod çubuğu** hemen altında: çizim modları, ayna ve kenarlık.
- **Araç çubuğu** solda; en üstte geri al ve yinele.
- **Renk çubuğu** onun yanında; geçerli ekran modunun paletiyle.
- **Tuval** ortada.
- **Paneller** sağda: katmanlar, araç seçenekleri, dönüşüm, referans resmi, ön
  ayarlar.
- **Durum çubuğu** en altta; ekran modunu, çizim modunu ve dokunmanın çizip
  çizmediğini gösterir.

![Araç çubuğu](img/tool-rail.png)

*Araç çubuğu. Geri al ve yinele en üsttedir; alttaki araçlar resme ne
yaptıklarına göre gruplanmıştır.*

![Renk çubuğu](img/colour-rail.png)

*Renk çubuğu: solda MÜREKKEP, sağda KAĞIT, üstlerinde PARLAK ve YANIP SÖNME.*

![Mod çubuğu](img/colour-bar.png)

*Mod çubuğu: çizim modları, ayna ve kenarlık rengi.*

![Yan paneller](img/panels.png)

*Paneller. Her biri daraltılabilir; böylece yalnızca kullandıklarınızı açık
tutarsınız.*

![Durum çubuğu](img/status-bar.png)

*Durum çubuğu, bir sonraki vuruşunuzun ne yapacağını belirleyen ayarları
gösterir.*

Araç çubuğunda etiket yoktur – düğmelerin yanında onlara yer yoktur. Adını görmek
için herhangi bir denetimin üzerine gelin, açıklayan bir cümleyi okumak için
biraz bekleyin. Tablette bunun yerine basılı tutun; basılı tutmak aracı da
değiştirmez.

### Tablette

Tableti yatay tutun. PixULA tablette bilgisayardakiyle aynı pencereyi kullanır
ve dikey tutulduğunda tuvale panellerin yanında yeterli genişlik kalmaz; bu
yüzden cihazı çevirmenizi ister. Küçük bir ekranda arayüzün tamamı sığacak kadar
küçülür, ama hiçbir zaman bir parmağın hâlâ isabet ettirebileceği boyutun altına
inmez ve seçtiğiniz arayüz boyutu daha büyük bir ekranda geri gelir. Fare veya
dokunmatik yüzey bağlıyken tablet bilgisayar gibi davranır ve her iki yönde de
kullanılabilir.
