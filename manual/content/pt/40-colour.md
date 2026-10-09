## A cor

Nos modos clássicos não escolhe uma cor para um píxel. Escolhe as duas cores
que uma célula inteira vai usar, mais dois indicadores.

- **TINTA** é a cor dos pontos acesos.
- **PAPEL** é a cor dos pontos apagados.
- **BRILHO** leva ambas à sua versão mais clara. Há um indicador de brilho por
  célula, por isso tinta e papel têm brilho juntos ou nenhum o tem.
- **PISCAR** troca tinta e papel cerca de duas vezes por segundo no hardware
  real.

O botão esquerdo do rato desenha com tinta. O direito desenha com papel: apaga
o ponto e define os mesmos quatro valores que o esquerdo definiria. Numa
caneta, o botão lateral faz o mesmo que o botão direito.

A **borracha** faz algo diferente de ambos. Apaga pontos e deixa as cores da
célula intactas, mesmo quando apaga o último ponto da célula. Para apagar
também as cores, passe de novo a borracha sobre a célula vazia com um traço
novo: tinta, papel, brilho e piscar voltam a preto sobre branco, e numa camada
superior a célula volta a ser transparente. Uma célula que ainda tem pontos
mantém as cores por mais vezes que passe a borracha.

Cada um dos quatro também pode ser posto em **usar o existente**: a caixa
axadrezada por baixo dele na barra de cores. Um traço deixa então essa parte de
cada célula como já está, em vez de escrever a sua definição. Ponha TINTA, PAPEL
e BRILHO em existente e ligue PISCAR, e a opção **Preencher apenas atributos**
da ferramenta de preenchimento faz piscar uma área inteira sem mudar nenhuma
cor. Shift+B e Shift+F alternam BRILHO e PISCAR, e Shift+T põe os quatro em
existente. No ULAplus, BRILHO e PISCAR escolhem a CLUT, por isso o seletor de
CLUT tem uma só caixa, que mantém a CLUT de cada célula.

### Modos de desenho

O modo de desenho muda o que faz um traço. Mantém-se entre sessões, por isso a
barra de estado mostra-o sempre que não é Normal – em alguns destes modos um
traço não deixa nada visível, e de outro modo não teria forma de saber porquê.

{{draw-modes}}

O pincel em todas as suas formas, o preenchimento, as formas, a curva de Bézier,
o texto, os carimbos do painel **Carimbos** e o botão esquerdo do gradiente
seguem o modo de desenho. A borracha, o conta-gotas, mover, colar e apagar uma
seleção, o painel **Transformação**, a opção **Preencher apenas atributos** e os
botões Trocar e Recolorir ignoram-no.

**Recolorir tinta não é o mesmo que Recolorir.** Recolorir tinta e Recolorir
papel são modos de desenho: recolorem cada célula em que a ferramenta atual toca
(poucas com um pincel pequeno, todas as que um retângulo preenchido cobre) e o
Espelho aplica-se. **Recolorir**, logo depois do separador, recolore a célula
inteira sob o ponteiro seja qual for a ferramenta escolhida, ignorando o tamanho
do pincel e o Espelho. **Trocar**, ao lado, funciona da mesma maneira e troca a
tinta e o papel de cada célula. Qualquer um deles fica ligado até clicar nele de
novo ou escolher uma ferramenta ou um modo de desenho, e a barra de estado
indica-o enquanto está ligado.

**XOR / Sobre e XOR / Cada passagem** invertem os pontos em vez de os acender, e
ambos dão à célula as cores escolhidas. XOR / Sobre inverte cada ponto uma vez
por traço, por isso voltar à sua própria linha no mesmo traço não muda mais
nada. XOR / Cada passagem inverte um ponto sempre que o traço passa por ele: uma
passagem do pincel conta como uma, por muito que o pincel se sobreponha a si
próprio pelo caminho, mas um traço que sai de um ponto e volta inverte-o outra
vez, por isso um oito anula-se onde se cruza. Formas, curvas, preenchimentos e
texto são sempre uma única passagem, por isso com eles os dois modos dão o mesmo
resultado.

**Inverso** troca o que fazem os dois botões do rato: o esquerdo apaga pontos e
o direito acende-os, como o INVERSE 1 do BASIC. É o botão logo a seguir aos
modos de desenho, ou Shift+I, e a barra de estado diz «Inverso ligado» enquanto
estiver. Não muda nada em Recolorir tinta, Recolorir papel e nos dois modos XOR,
onde os dois botões fazem o mesmo, e a barra de estado di-lo. O texto e os
carimbos apagam as suas letras e formas em vez de as acenderem, um padrão põe os
seus pontos como apagados e os seus intervalos como pontos, e o preenchimento
preenche com papel no botão esquerdo e com tinta no direito. A borracha, Trocar
e Recolorir ignoram-no. É lembrado entre sessões e guardado nas predefinições
com o modo de desenho.

**Núcleo de cor.** Para o pincel redondo e quadrado, os contornos de formas e a
curva de Bézier, Núcleo de cor diz quanto de uma linha grossa toma as cores da
célula. Uma linha acende sempre todos os pontos. Com Núcleo de cor em 1 píxel ou
4 píxeis, só as células sob o meio da linha, uma linha dessa largura que segue o
seu centro, tomam as tuas cores; as outras células por baixo recebem os pontos
com as cores que já tinham, e assim uma linha grossa colide com menos células.
Toda a linha, a predefinição, colore cada célula que a linha toca. A opção só
aparece em modos de ecrã com cores de célula. Com Espelho a linha refletida tem
um núcleo próprio, e com XOR as células fora do núcleo mantêm as suas cores.

### Paletas

Duas famílias de modos permitem mudar as próprias cores. O ULAplus dá-lhe 64
registos de cor, organizados como quatro paletas de dezasseis. Os modos Next
dão-lhe 256 cores de nove bits cada.

As paletas são ficheiros. Pode criar uma, guardá-la e carregá-la noutra imagem,
em **Ficheiro > Carregar paleta** e **Ficheiro > Guardar paleta** ou no editor
de paletas. Não precisa de abrir o editor para carregar uma, já que carregar
uma paleta é normalmente algo que se faz antes de começar a desenhar.

Quando um formato de ficheiro tem espaço para uma paleta – `.scr` com 6976
bytes, `.nxi`, a variante Timex –, a paleta viaja também dentro da imagem.

### GigaScreen

O GigaScreen mantém dois ecrãs completos e mostra-os alternadamente, cinquenta
vezes por segundo. O olho mistura as duas cores de cada píxel numa só, por
isso uma célula com uma tinta e um papel em cada ecrã pode mostrar **quatro**
cores, e a imagem inteira pode chegar a cerca de cem.

Nunca desenha só num ecrã. Cada traço escreve nos dois, e a barra de cores
funciona aos pares:

- **Ecrã A** e **Ecrã B** têm cada um as suas amostras de tinta e papel e o seu
  próprio **BRILHO**. O piscar é uma definição única para ambos.
- **Pintar** mostra as quatro cores que resultam dessas escolhas, misturadas
  exatamente como a tela as mostra: tinta nos dois ecrãs, tinta só em A, tinta
  só em B e papel nos dois. Escolha uma e o botão esquerdo pinta com ela. O
  botão direito pinta sempre papel nos dois ecrãs.
- Escolha a mesma tinta para os dois ecrãs e a amostra superior esquerda de
  Pintar é essa cor, pura – é assim que se desenha tudo o que não deve parecer
  misturado.

O conta-gotas recolhe tudo isto: as cores de ambos os ecrãs e qual das quatro o
píxel mostra.

Os botões de visualização mudam apenas o que a tela mostra, nunca para onde vai
um traço. **Média** é o que o olho vê na máquina real. **Cintilação** troca os
dois ecrãs a cada fotograma, como faz o hardware. **A** e **B** mostram um ecrã
sozinho. Uma imagem guardada ou exportada como PNG usa Média quando está a ser
mostrada a Cintilação, já que uma imagem fixa não pode cintilar.

Entrar em GigaScreen copia a imagem para os dois ecrãs, por isso fica igual ao
que era. Sair mantém o ecrã A e descarta o ecrã B, e é avisado antes se o
ecrã B tiver algo diferente.

A mesma forma de trabalhar serve para mais dois modos de cintilação:

- **MultiGigaScreen 8×4, 8×2 e 8×1** põem os dois ecrãs nas células Multicolor
  mais finas, por isso as quatro cores valem por cada 4, 2 ou uma linha em vez
  de por bloco de 8 por 8. São os ficheiros `.mg4`, `.mg2` e `.mg1` do
  MultiArtist.
- **Timex alta resolução GigaScreen** alterna dois ecrãs de alta resolução de
  512 por 192. A alta resolução não tem cores de célula – cada ecrã tem um
  esquema de cores para toda a imagem –, por isso a barra mostra uma fila de
  esquemas para o Ecrã A e outra para o Ecrã B, e Pintar mostra as quatro
  misturas dos dois. São ficheiros `.hrg`.

Mudar entre quaisquer modos de dois ecrãs mantém ambos os ecrãs, pelas mesmas
regras com que se converte um ecrã simples.

### Atributos

Os itens Atributos do menu Imagem mudam as cores das células e deixam os
pontos onde estão. Inverter troca a tinta e o papel de cada célula e mantém o
brilho e o pisca. Apagar escreve a tinta, o papel, o brilho e o pisca atuais
em cada célula; as caixas «usar existente» mantêm o que cada célula já tem.
Espelhar horizontalmente e Espelhar verticalmente espelham as cores das
células. Cada comando atua sobre a seleção (todas as células que toca) ou sobre
a imagem inteira quando nada está selecionado, e desfaz-se num único passo. Os
itens ficam esmaecidos nos modos sem cores de célula (Timex Hi-res, Layer 2,
LoRes), enquanto um carimbo está flutuante e numa camada bloqueada.

Alterar... encontra células pelas suas cores e substitui-as. Localizar indica quais células correspondem: cada campo é um valor ou Qualquer. Substituir por indica no que se tornam: cada campo é um valor ou Manter. A caixa mostra quantas células vão mudar antes de premir OK, e OK desfaz-se num único passo. O GigaScreen tem um grupo para o Ecrã A e outro para o Ecrã B; no ULAplus, o CLUT 0-3 ocupa o lugar de Brilho e Piscar. Cancelar não altera nada.

### Pontos

Os itens Pontos do menu Imagem alteram os pontos e deixam as cores nas suas células. Espelhar horizontal e Espelhar vertical espelham os pontos. Inverter pontos e cores também troca a tinta e o papel de cada célula, por isso a imagem continua igual. Não são oferecidos em modos sem cores de célula (Layer 2, LoRes, Timex Hi-res) e ficam acinzentados enquanto um carimbo flutua.

A opção Mover na secção Deslocar do painel Transformar escolhe o que se move. Pontos e cores (predefinição) move células inteiras com o seu papel. Só pontos move os pontos um píxel ou uma célula de cada vez. Só cores move as cores das células uma célula de cada vez. O painel tem também as diagonais. Enquanto um carimbo flutua, Mover fica acinzentado, porque um deslocamento move o carimbo inteiro.

Quando há uma seleção, as setas seguem a mesma opção Mover.
