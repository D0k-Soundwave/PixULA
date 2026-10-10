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
A opção **Cores** da borracha, visível nos modos de ecrã com cores de célula,
muda isto: Pôr as atuais apaga os pontos e dá à célula as cores da barra, como a
ferramenta de limpeza do ZX Paintbrush, e Manter, a predefinição, é o
comportamento descrito acima.

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

A faixa de cima tem três botões: **Modo de desenho**, **Ferramenta de célula** e
**Espelho**. Cada um mostra a escolha em vigor. Clica e por baixo abre-se uma
pequena grelha com as outras escolhas; clica numa e a grelha fecha-se. Carrega
em Escape, ou clica noutro sítio, para a fechar sem mudar nada. O modo de
desenho e o espelho funcionam juntos: com XOR e Horizontal, um traço é um traço
XOR refletido. A ferramenta de célula, quando há uma ligada, assume todos os
traços.

{{draw-modes}}

O pincel em todas as suas formas, o preenchimento, as formas, a curva de Bézier,
o texto, os carimbos do painel **Carimbos** e o botão esquerdo do gradiente
seguem o modo de desenho. A borracha, o conta-gotas, mover, colar e apagar uma
seleção, o painel **Transformação**, a opção **Preencher apenas atributos** e os
botões Trocar e Recolorir ignoram-no.

**Recolorir tinta não é o mesmo que Recolorir.** Recolorir tinta e Recolorir
papel são modos de desenho: recoloram todas as células que a ferramenta atual
toca - umas poucas com um pincel pequeno, todas as que um retângulo preenchido
cobre - e o espelho aplica-se. **Recolorir**, no botão Ferramenta de célula,
recolora a célula inteira sob o ponteiro seja qual for a ferramenta, ignorando o
tamanho do pincel e o espelho. **Trocar**, do mesmo botão, funciona igual e
troca tinta e papel de cada célula. Qualquer um continua ligado até o desligares
- escolhe Nenhuma, escolhe-o de novo, clica com o botão direito na tela ou
escolhe uma ferramenta ou um modo de desenho - e a barra de estado di-lo
enquanto está ligado.

**Copiar cores, Inverter pontos e Inverter pontos e cores** são mais três
ferramentas de célula no mesmo botão Ferramenta de célula, e funcionam da mesma
forma: escolhe uma e depois clica ou arrasta sobre células. Cada arrastamento
desfaz-se num só passo e a ferramenta fica ligada até a desligares. **Copiar
cores** apanha as cores que a célula sob o teu primeiro clique mostra e dá-as a
cada célula sobre a qual arrastas; a barra de cores não muda. **Inverter
pontos** apaga os pontos acesos de cada célula inteira e acende os apagados, e
deixa as cores (numa célula em branco preenche-a). **Inverter pontos e cores**
troca também tinta e papel, para cada célula ficar com o mesmo aspeto; serve
para arrumar uma imagem importada, salta as células em que outra camada também
desenha e não é oferecido em ULAplus nem ULANext. Uma ferramenta de célula só é
oferecida nos modos de ecrã em que pode funcionar: o botão Ferramenta de célula
lista só as que servem (e fica escondido onde nenhuma serve), e Inverter pontos
também funciona em Timex Hi-res, onde os pontos estão em células de 8 por 8.

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
o direito acende-os, como o INVERSE 1 do BASIC. Liga-se nas Preferências, ou com Shift+I, e a barra de estado diz «Inverso ligado» enquanto
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

**Posições da paleta.** A paleta ULAplus e a paleta Next têm cada uma quatro posições, em Imagem > Paleta (Posição 1 a Posição 4). A posição em uso está marcada, e o editor de paleta diz qual está a editar. Um documento novo começa na Posição 1, e as outras guardam a paleta predefinida até as usar. Escolher outra posição muda as cores com que a imagem é mostrada e nunca muda os atributos de cor da imagem. Cada escolha é um passo de anular. As posições são guardadas num projeto e na cópia de segurança automática, mas só depois de usar uma posição; uma imagem aberta de outro tipo de ficheiro começa na Posição 1 e as outras guardam cópias da sua paleta. As exportações .scr, .tap e de imagem usam sempre a posição em uso. Os modos de paleta fixa (ULA padrão, os modos Multicolor, GigaScreen e os modos Timex) não têm posições.

**Inverter paleta** (só ULAplus) troca a metade da tinta (entradas 0-7) com a metade do papel (entradas 8-15) de cada uma das quatro CLUT, num passo de anular; fazê-lo duas vezes repõe a paleta. Para inverter uma imagem ULAplus de modo que fique igual, use Inverter paleta e depois Imagem > Atributos > Inverter. A margem segue a metade do papel da CLUT 0, por isso também muda de cor. Os modos Next não têm inversor de paleta, porque o ULANext guarda a tinta em 8 entradas da paleta e o papel em 32.

**Teclas CLUT.** Nos modos ULAplus, Ctrl+Shift+1 a Ctrl+Shift+4 escolhem a CLUT 0 a 3, tal como a escolha de CLUT da barra de cores. Nos outros modos a barra de estado di-lo e não acontece mais nada.

**Cores padrão.** Em Definições > Preferências, Cores padrão permite mudar as 15 cores que os modos Padrão, Multicolor, GigaScreen e Timex mostram. O preto brilhante é sempre preto. As cores mudam o que vê e o que as exportações de imagem contêm (PNG, GIF, BMP, JPG); nunca mudam os bytes dos ficheiros .scr ou .tap, e a importação de uma imagem continua a comparar com as cores originais do Spectrum, por isso a mesma fotografia dá a mesma imagem em qualquer máquina. As paletas ULAplus e Next são separadas. OK aplica as cores, Cancelar não guarda nada e Repor o padrão devolve as originais. Ficam guardadas neste navegador, não no projeto. Carregar .pal lê um ficheiro de cores padrão do ZX Paintbrush (256 bytes) e Guardar .pal escreve um, que é a forma de levar as suas cores para outro navegador.

**Fitas de paleta.** Ficheiro > Guardar paleta como TAP escreve a paleta ULAplus como uma fita de 176 bytes. Carregada num Spectrum com `LOAD ""` define as 64 entradas da paleta e depois carrega o ficheiro seguinte da fita, por isso uma fita de paleta pode ficar à frente de uma fita de imagem ou de jogo. Ficheiro > Carregar paleta e Ficheiro > Abrir leem fitas de paleta: as do PixULA e as do ZX Paintbrush. Uma fita de paleta entra na posição de paleta em uso num passo de anular e não passa a ser o ficheiro aberto.

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
LoRes), enquanto um carimbo sem cores próprias está flutuante e numa camada bloqueada.

Alterar... encontra células pelas suas cores e substitui-as. Localizar indica quais células correspondem: cada campo é um valor ou Qualquer. Substituir por indica no que se tornam: cada campo é um valor ou Manter. A caixa mostra quantas células vão mudar antes de premir OK, e OK desfaz-se num único passo. O GigaScreen tem um grupo para o Ecrã A e outro para o Ecrã B; no ULAplus, o CLUT 0-3 ocupa o lugar de Brilho e Piscar. Cancelar não altera nada.

### Pontos

Os itens Pontos do menu Imagem alteram os pontos e deixam as cores nas suas células. Espelhar horizontal e Espelhar vertical espelham os pontos. Inverter pontos e cores também troca a tinta e o papel de cada célula, por isso a imagem continua igual. Não são oferecidos em modos sem cores de célula (Layer 2, LoRes, Timex Hi-res) e ficam acinzentados enquanto um carimbo flutua. Em ULAplus e ULANext também não é oferecido, porque trocar tinta e papel mudaria o aspeto da imagem.

A opção Mover na secção Deslocar do painel Transformar escolhe o que se move. Pontos e cores (predefinição) move células inteiras com o seu papel. Só pontos move os pontos um píxel ou uma célula de cada vez. Só cores move as cores das células uma célula de cada vez. O painel tem também as diagonais. Enquanto um carimbo flutua, Mover fica acinzentado, porque um deslocamento move o carimbo inteiro.

Quando há uma seleção, as setas seguem a mesma opção Mover.

### Carimbos

Quando um carimbo está ativo, o painel **Transformar** mostra como é colocado.

**Cores** escolhe entre Só píxeis e Cores próprias. Só píxeis coloca os pontos do carimbo nas cores da barra de atributos, como sempre. Cores próprias coloca as cores que o carimbo leva, célula a célula: um carimbo do Editor de mapas, ou um copiado de uma imagem num modo com cores de célula. Um carimbo copiado da imagem começa como Só píxeis, por isso uma colagem cai exatamente como antes. Cores próprias assenta o carimbo em células inteiras, ignora o modo de desenho, a barra de cores e o interruptor XOR, e não pode ser redimensionado, rodado, curvado, espelhado, invertido nem contornado; o painel desativa essas opções e diz porquê. Mudar a forma de um carimbo Só píxeis descarta as cores que levava. Inverso continua a trocar o que fazem os pontos cheios e vazios. Se as células do carimbo têm um tamanho diferente do modo de ecrã atual, só é possível Só píxeis.

**Deixar ver** (só com Cores próprias) deixa ver a cor que já está na página em vez da do carimbo. Tinta, Papel, Brilho e Intermitência têm cada um a sua caixa. O ULAplus tem uma caixa CLUT para Brilho e Intermitência juntos. No GigaScreen cada caixa cobre os dois ecrãs.

**Pontos vazios** decide o que fazem os pontos vazios do carimbo. Deixar o fundo deixa em paz o desenho por baixo (um carimbo com cores próprias continua a recolorir o papel por baixo, salvo se o Papel se vir). Apagar o fundo apaga-o também, em todo o retângulo do carimbo. Os modos de desenho sem oposto (XOR, Recolorir tinta, Recolorir papel) e o interruptor XOR próprio do carimbo deixam os pontos vazios em paz, e o painel di-lo. Pontos vazios está disponível em todos os modos de ecrã, mesmo sem cores de célula.

**Converter em só píxeis** descarta para sempre as cores do carimbo e mantém os seus pontos. A escolha Só píxeis em Cores mantém-nas, por isso pode voltar atrás. Cada alteração é um passo de anular.

Enquanto um carimbo com cores próprias está ativo, os comandos de Imagem > Atributos (Inverter, Apagar, os dois Espelhar e Alterar...) atuam nas células do carimbo em vez da imagem, quer flutue quer esteja guardado. Ignoram a seleção e nunca tocam nos pontos do carimbo, e uma célula que o carimbo não cobre fica como está. Espelhar reflete as células de cor do carimbo enquanto os pontos ficam onde estão. Um carimbo GigaScreen tem um só conjunto de cores para os dois ecrãs, por isso o diálogo Alterar mostra um grupo. Cada comando é um passo de anular. Com um carimbo sem cores próprias continuam esmaecidos.
