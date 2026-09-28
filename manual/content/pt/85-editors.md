## Os editores

Quatro coisas que o PixULA faz não são imagens, e cada uma tem a sua janela no
menu Ficheiro.

### O editor de tipos de letra

Um conjunto de caracteres do Spectrum tem 96 ou 256 glifos, cada um guardado
como uma pilha de bytes de linha. Este editor altera-os um glifo de cada vez.

![O editor de tipos de letra, com a grelha de glifos de um lado e um carácter em edição do outro](img/dialog-font-editor.png)

*Escolha um carácter na grelha à esquerda e edite-o à direita.*

Os glifos podem ter 4, 6 ou 8 píxeis de largura pela altura da célula.
Estreitar um tipo de letra descarta para sempre as colunas da direita, por isso
se estiver a experimentar larguras, trabalhe do estreito para o largo.

Pode começar pelo tipo de letra ZX ROM, capturar um glifo da tela ou carregar um
conjunto `.ch4`, `.ch6`, `.ch8`, `.chr` ou `.chx` de outra ferramenta de
Spectrum. Dar um nome a um tipo de letra acrescenta-o à sua biblioteca, e a
ferramenta Texto passa a oferecê-lo ao lado do tipo de letra ROM incorporado.

### O editor de mapas

Um mapa é uma grelha de mosaicos, em que um mosaico é uma célula de 8 por 8 –
oito bytes de bitmap e um byte de atributos. Os mapas permitem construir um
cenário maior do que um único ecrã.

![O editor de mapas, com a paleta de mosaicos e uma área de mapa deslizante](img/dialog-map-editor.png)

*Os mosaicos à esquerda, o mapa à direita.*

Pinte com o botão esquerdo e apague com o direito, ou use o preenchimento para
substituir uma área ligada de mosaicos iguais. Os mosaicos vêm do padrão e das
cores atuais, ou diretamente da tela. Pode passar um mapa de volta para a tela,
e um único anular reverte tudo.

Guarde como `.zxtm` para continuar a trabalhar – é o formato próprio do PixULA e
guarda tudo – ou como `.zxm`, ou como assembly, C ou binário em bruto para
incluir num programa.

### O editor de sprites

Os sprites do Next têm 16 por 16 píxeis com um índice de paleta por píxel, e
uma folha contém até 64.

![O editor de sprites, com uma folha de sprites e a grelha de edição](img/dialog-sprite-editor.png)

*A folha de um lado, o sprite que está a desenhar do outro.*

As folhas de sprites guardam-se em ficheiros `.spr`, não dentro da imagem, por
isso guarde a folha à parte. Nos modos indexados pode capturar um sprite da tela
e carimbar um sobre ela.

### O editor de paletas

**Imagem > Editar paleta**, nos modos que têm paleta editável. Mostra o ULAplus
como quatro paletas de dezasseis e a paleta Next como filas de cores de nove
bits. Qualquer cor que escolha é ajustada ao valor mais próximo que o hardware
consegue realmente guardar, por isso o que vê é o que a máquina vai mostrar.

Cada alteração é um passo de anular separado. As paletas também podem ser
carregadas e guardadas sem abrir esta janela – veja o capítulo sobre a cor.

### Blocos de fita

**Ficheiro > Blocos de fita** abre um `.tap` ou `.tzx` e lista o que contém.
Use-o para carregar um ecrã de uma fita que tem vários, ou para acrescentar a
imagem atual a uma fita como bloco novo e voltar a guardar a fita.

Os blocos em que não mexeu são reescritos byte a byte, por isso acrescentar um
ecrã à fita de outra pessoa deixa o resto exatamente como estava.
