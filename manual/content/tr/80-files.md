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
