## O conflito de atributos

O Spectrum guarda uma imagem em duas partes separadas.

A primeira é um bitmap: 256 por 192 pontos, um bit cada, aceso ou apagado. A
segunda é uma grelha de cor, um byte por cada bloco de 8 por 8 desses pontos –
32 bytes na largura e 24 na altura. Cada um desses bytes indica de que cor deve
ser a **tinta** (os pontos acesos), de que cor o **papel** (os pontos
apagados), se o par tem **brilho** e se deve **piscar**.

Assim, a forma da imagem tem uma resolução de 256 por 192, e a cor uma
resolução de 32 por 24. Cada célula de 8 por 8 pode mostrar duas cores, e cada
ponto dentro dela é uma ou outra.

![Duas linhas diagonais cruzam-se numa tela ampliada com a grelha de células visível. A linha azul fica vermelha em cada célula por onde também passa a linha vermelha](img/attribute-clash.png)

*Uma linha azul e uma vermelha a cruzarem-se, a 800% com a grelha de células.
Onde a linha vermelha atravessa uma célula, a linha azul nessa célula também
fica vermelha. O traço vermelho chegou depois e definiu a cor de tinta de toda
a célula, incluindo os pontos que o traço azul já tinha posto.*

É isto que significa «conflito de atributos» (*attribute clash*). Desenhar numa
parte de uma célula muda a cor de tudo o resto nela, e não há definição que o
desligue – é assim que o hardware funciona.

### Trabalhar com ele

A maioria dos artistas de Spectrum planeia as áreas de cor antes do pormenor,
dispondo a imagem de modo que as fronteiras de cor coincidam com as fronteiras
das células. Quando uma célula precisa de um tom que não consegue conter,
recorrem ao pontilhado: duas cores intercaladas de forma tão fina que o olho as
mistura.

O PixULA ajuda nisto de três maneiras.

**A grelha de células.** Ative-a junto aos controlos de zoom e verá exatamente
onde uma mudança de cor é gratuita e onde lhe vai custar.

**Os modos de desenho.** Um traço não tem de mudar ao mesmo tempo os pontos e
as cores. Pode pôr pontos sem mexer nas cores, ou recolorir uma célula sem
tocar num ponto. O capítulo sobre a cor enumera-os.

**A biblioteca de padrões.** O seu núcleo é um conjunto de mosaicos com
densidades de tinta medidas, aquilo a que recorre quando uma célula precisa de
um cinzento que não consegue conter.

### Onde as regras mudam

O hardware posterior aliviou a restrição de várias formas, e o PixULA consegue
trabalhar com todas. As máquinas Timex tornaram a grelha de cor mais fina. O
ULAplus substituiu as dezasseis cores fixas por uma paleta à sua escolha. O
GigaScreen alterna duas imagens com rapidez suficiente para sugerir cores que
nenhuma delas contém. O ZX Spectrum Next abandona o esquema por completo nos
modos Layer 2 e LoRes, onde cada píxel tem a sua própria cor.

Pode passar uma imagem de um para outro – veja o capítulo seguinte.
