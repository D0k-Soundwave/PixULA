## Primeiros passos

O PixULA é um editor de pixel art para o ZX Spectrum e o ZX Spectrum Next.
Funciona num navegador, a partir de uma pasta no seu próprio disco, sem
instalação, sem servidor e sem ligação à Internet.

Descompacte a pasta onde quiser e faça duplo clique em `PixULA.html`. É toda a
instalação. Nada é escrito fora dessa pasta a menos que o peça, e nada do que
desenha sai do seu computador.

### A primeira coisa a saber

O Spectrum não consegue pôr qualquer cor em qualquer sítio. Guarda a imagem
como um bitmap de um bit por píxel, com uma grelha de cor separada e muito mais
grosseira por cima, e dentro de cada bloco de 8 por 8 só há duas cores
disponíveis. Este único facto determina o comportamento de cada ferramenta, e é
o tema do capítulo seguinte.

### Orientar-se

![A janela do PixULA: barra de menus, barra de modos, barra de ferramentas, barra de cores, tela, painéis e barra de estado](img/workspace.png)

*A janela completa.*

- **A barra de menus** no topo: ficheiros, edição, a vista, camadas, a própria
  imagem, definições e ajuda.
- **A barra de modos** por baixo: modos de desenho, Trocar e Recolorir, e espelho.
- **A barra de ferramentas** à esquerda, com anular e refazer no topo.
- **A barra de cores** ao lado, com a paleta do modo de ecrã atual.
- **A tela** ao centro.
- **Os painéis** à direita: camadas, opções de ferramenta, transformação, a
  imagem de referência, predefinições.
- **A barra de estado** em baixo, que mostra o modo de ecrã, o modo de desenho
  e se o toque desenha.

![A barra de ferramentas](img/tool-rail.png)

*A barra de ferramentas. Anular e refazer ficam no topo; as ferramentas por
baixo estão agrupadas pelo que fazem à imagem.*

![A barra de cores](img/colour-rail.png)

*A barra de cores: TINTA à esquerda, PAPEL à direita, com BRILHO e PISCAR por
cima.*

![A barra de modos](img/colour-bar.png)

*A barra de modos: modos de desenho, depois Trocar e Recolorir, depois espelho.*

![Os painéis laterais](img/panels.png)

*Os painéis. Cada um recolhe-se, para manter abertos só os que usa.*

![A barra de estado](img/status-bar.png)

*A barra de estado, com as definições que decidem o que fará o seu próximo
traço.*

A barra não tem legendas – não há espaço ao lado dos botões. Passe o ponteiro
sobre qualquer controlo para ver o nome, e mantenha-o lá para ler uma frase que
o explica. Num tablet, mantenha premido; essa pressão não muda também de
ferramenta.

### Num tablet

Segure o tablet na horizontal. O PixULA usa num tablet a mesma janela que num
computador, e na vertical não há largura suficiente para a tela ao lado dos
painéis, por isso pede-lhe que rode o dispositivo. Num ecrã pequeno, toda a
interface encolhe para caber, nunca abaixo de um tamanho que um dedo ainda
consiga acertar, e o tamanho da interface que escolheu volta num ecrã maior.
Com um rato ou trackpad ligado, o tablet é tratado como um computador e pode
ser usado em qualquer orientação.
