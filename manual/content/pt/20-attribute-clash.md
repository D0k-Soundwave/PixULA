## O conflito de atributos

O Spectrum guarda uma imagem em duas partes separadas.

A primeira é um bitmap: 256 por 192 píxeis, um bit cada, um píxel de tinta ou
um píxel de papel. A segunda é uma grelha de atributos, um byte por cada bloco
de 8 por 8 desses píxeis – 32 bytes na largura e 24 na altura. Cada um desses
bytes indica de que cor deve ser a **Tinta** (a cor dos píxeis de tinta), de
que cor o **Papel** (a cor dos píxeis de papel), se o par tem **Brilho** e se
deve **Piscar**.

Assim, a forma da imagem tem uma resolução de 256 por 192, e a cor uma
resolução de 32 por 24. Cada célula de 8 por 8 pode mostrar duas cores, e cada
píxel dentro dela é uma ou outra.

![Duas linhas diagonais cruzam-se numa tela ampliada com a grelha de células visível. A linha azul fica vermelha em cada célula por onde também passa a linha vermelha](img/attribute-clash.png)

*Uma linha azul e uma vermelha a cruzarem-se, a 800% com a grelha de células.
Onde a linha vermelha atravessa uma célula, a linha azul nessa célula também
fica vermelha. O traço vermelho chegou depois e definiu a Tinta de toda
a célula, incluindo os píxeis de tinta que o traço azul já tinha posto.*

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

**Os modos de desenho.** Um traço não tem de mudar ao mesmo tempo os píxeis e
os atributos. Pode desenhar píxeis de tinta sem mexer nos atributos, ou
recolorir uma célula sem tocar num píxel. O capítulo sobre a cor enumera-os.

**A biblioteca de padrões.** O seu núcleo é um conjunto de mosaicos com
densidades medidas de píxeis de tinta, aquilo a que recorre quando uma célula precisa de
um cinzento que não consegue conter.

### Ver os píxeis

Três interruptores do menu Ver mudam o que o ecrã mostra, sem mudar a imagem.
**Atributos desligados** mostra os píxeis de tinta a preto e os píxeis de
papel a branco, para veres quais píxeis são realmente de tinta. **Grelha de cores** faz o mesmo e além disso
tinge as células como um tabuleiro de xadrez, para os limites das células se
verem bem; ela e Atributos desligados desligam-se mutuamente. **Parar
intermitência** mantém cada célula intermitente nas suas cores normais. Nenhum
toca na imagem, no anular ou numa exportação: uma imagem guardada fica igual com
eles ligados ou desligados. O navegador lembra-se deles, e um interruptor que
não pode funcionar no modo de ecrã atual aparece a cinzento – passa o rato por
cima para veres porquê. No GigaScreen e no MultiGiga, Atributos desligados mostra
quatro níveis de cinzento: branco onde nenhum ecrã tem píxel de tinta,
cinzento claro para um píxel de tinta só no ecrã A, um cinzento mais escuro só no ecrã B e preto para
ambos.

### Ler o ponteiro

A faixa sob a imagem e a barra de estado dizem onde está o ponteiro. Nas
**Preferências**, *A leitura do ponteiro mostra* acrescenta o atributo sob o
ponteiro (o seu número em decimal e em hexadecimal, depois Tinta, Papel, Brilho
e Piscar; a CLUT em ULAplus; os dois ecrãs em GigaScreen) e o endereço de
memória do byte do píxel e do seu byte de atributo. Há endereços onde a máquina
real tem uma disposição fixa: ULA padrão e ULAplus (ficheiro de ecrã desde
$4000, atributos desde $5800), Timex de cor alta (atributos no segundo ficheiro
de ecrã, em $6000), Timex de alta resolução (colunas de bytes pares em $4000,
ímpares em $6000) e GigaScreen (ecrã A como o padrão, ecrã B no banco 7 em
$C000; que ecrã pertence a que banco é uma convenção). Os outros modos dizem que
não têm endereço.

*O Y conta-se a partir de* pode ficar em baixo, para a leitura ser como no BASIC
PLOT, onde 0,0 é o canto inferior esquerdo e o Y vai de 0 a 175. Isso só existe
nas 176 linhas de cima de uma imagem de 256 por 192; abaixo, e noutros ecrãs, a
leitura mostra um traço. Altera só a leitura.

**Grelha personalizada...** no menu Ver desenha uma grelha com qualquer passo X
e Y, definidos em separado, e **Mostrar grelha personalizada** liga-a e
desliga-a. As linhas a menos de quatro píxeis de ecrã umas das outras são
omitidas até ampliares. As grelhas ligadas voltam da próxima vez que abrires o
programa. Nas Preferências, *Cores das grelhas* define a cor de cada grelha; se
deixares *Cor do tema* marcada, a grelha segue o tema.

### Onde as regras mudam

O hardware posterior aliviou a restrição de várias formas, e o PixULA consegue
trabalhar com todas. As máquinas Timex tornaram a grelha de atributos mais fina. O
ULAplus substituiu as dezasseis cores fixas por uma paleta à sua escolha. O
GigaScreen alterna duas imagens com rapidez suficiente para sugerir cores que
nenhuma delas contém. O ZX Spectrum Next abandona o esquema por completo nos
modos Layer 2 e LoRes, onde cada píxel tem a sua própria cor.

Pode passar uma imagem de um para outro – veja o capítulo seguinte.
