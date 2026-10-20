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

**Fontes grandes.** Nova fonte grande... cria um conjunto de fontes grandes CHX, como o que o ZX-Editor Second Edition usa: cada carácter tem 8, 16, 24 ou 32 pixéis de largura e de altura (largura e altura escolhem-se em separado), e o editor mostra o tamanho no lugar da lista de larguras. Marque Preencher com uma fonte para escolher qualquer fonte da mesma lista que a ferramenta Texto usa, quanta altura do carácter as letras ocupam (em percentagem) e se ficam à esquerda, ao centro ou à direita. Marque Proporcional e cada letra é guardada apenas com a largura de que precisa, em colunas inteiras de 8 pixéis, de modo que um i ocupa menos espaço do que um W; o carácter Espaço mantém sempre pelo menos uma coluna. Preencher a partir de fonte... faz o mesmo num só passo a uma fonte grande que já tenha. Uma fonte grande só pode ser guardada como `.chx` (os outros formatos e as listagens em assembly, C e binário têm caracteres de 8 por 8), não pode capturar uma célula da tela. A ferramenta Texto e Escrever na tela usam-na como qualquer fonte guardada, cada letra com a largura com que está guardada. Abrir um `.chx` grande mantém cada carácter com o seu tamanho, e um carácter que o ficheiro omite continua omitido ao guardar de novo. A forma como um carácter de vários blocos de 8 por 8 está disposto no ficheiro segue a descrição publicada do formato e não foi verificada com um ficheiro guardado pelo próprio ZX Paintbrush, por isso abra no ZX Paintbrush uma fonte grande feita aqui antes de confiar nela.

**Sombreado e anular.** Numa fonte cujos caracteres têm um número inteiro de colunas de 8 pixéis de largura, os quatro botões de Sombreado sombreiam ou desfazem o sombreado de uma coluna de cada vez, à esquerda ou à direita do carácter que está a editar. Uma coluna sombreada é desenhada riscada e não é guardada: um ficheiro `.chx` contém esse carácter mais estreito, e um carácter sombreado de lado a lado é omitido do ficheiro. Os píxeis de tinta sob o sombreado são mantidos no editor, por isso desfazer o sombreado traz-os de volta, mas não estão no ficheiro. Sombrear tudo ao ajuste faz isto para todos os caracteres de uma vez: sombreia as colunas vazias de cada lado dos píxeis de tinta, deixa uma coluna ao Espaço e omite os outros caracteres em branco. O carácter Espaço mantém sempre pelo menos uma coluna, porque um ficheiro `.chx` tem de o conter. Depois de exportar um `.chx`, a linha de estado diz quantos caracteres foram guardados mais estreitos, quantos foram omitidos e quantos tinham píxeis de tinta sob o sombreado. O Editor de fontes também tem Anular e Refazer (os dois botões, ou Ctrl+Z e Ctrl+Y): um traço na superfície de edição é um passo, tal como cada botão, Nova fonte grande, Preencher a partir de fonte, Carregar fonte ROM ou uma importação. Escrever na caixa do nome da fonte não conta.

**Todos os caracteres.** O botão Todos os caracteres troca o editor de um carácter por um mapa de toda a fonte, todos os caracteres lado a lado, 16 por linha, sobre o qual desenha com o mesmo Pincel, Borracha, Linha e Preenchimento, para que um traço possa passar de um carácter para o seguinte. Um traço é uma alteração e um passo de anular, e o Preenchimento fica dentro do carácter em que clica. A ferramenta Sombrear sombreia ou desfaz o sombreado da coluna de 8 pixéis em que clica, a partir da margem mais próxima do seu carácter; as colunas sombreadas aparecem riscadas. A ferramenta Mover arrasta o mapa, que é como o desloca com um dedo, porque o mapa reserva de outro modo cada toque para desenhar. Os botões menos, Ajustar e mais mudam o zoom em passos inteiros. No mapa e na grelha de caracteres, as setas, Início e Fim passam de carácter em carácter, e escrever um carácter escolhe-o. Não é possível desenhar pixéis só com o teclado.

**Atributos.** Um carácter de um ficheiro `.chx` pode ter atributos próprios: cada um dos seus blocos de 8 por 8 tem Tinta, Papel, Brilho e Piscar, e o editor desenha cada bloco com eles - na grelha de caracteres, na superfície de edição e no mapa Todos os caracteres (uma pequena marca no canto da superfície de edição mostra o Piscar). Escolha a ferramenta Atributos e clique num bloco para lhe dar a Tinta, o Papel, o Brilho e o Piscar da barra de atributos. Um ficheiro `.chx` dá atributos a um carácter inteiro, por isso o primeiro clique num carácter sem atributos dá-os a todos os seus blocos; depois cada clique muda um bloco. Todos os blocos dá ao carácter inteiro os atributos da barra, e Retirar atributos retira-os de novo, de modo que a ferramenta Texto usa a barra de atributos para esse carácter. Cada clique e cada botão é um passo de Anular. Os atributos precisam de uma fonte cuja largura seja um número inteiro de colunas de 8 píxeis e de uma barra de atributos com Tinta e Papel; em Timex hi-res, Layer 2 e LoRes a ferramenta diz porque não pode. Abrir um `.chx` mantém o byte de atributos de cada bloco e guardar volta a escrevê-lo; um carácter sem atributos é guardado exatamente como antes. Os outros formatos e as listagens em assembly, C e binário não guardam atributos, e depois de uma exportação assim a linha de estado diz quantos caracteres perderam os seus. Tal como nas fontes grandes, esta disposição segue a descrição publicada do formato e não foi verificada num ficheiro a cores guardado pelo ZX Paintbrush.

### O editor de mapas

Um mapa é uma grelha de mosaicos, em que um mosaico é uma célula de 8 por 8 –
oito bytes de bitmap e um byte de atributos. Os mapas permitem construir um
cenário maior do que um único ecrã.

![O editor de mapas, com a paleta de mosaicos e uma área de mapa deslizante](img/dialog-map-editor.png)

*Os mosaicos à esquerda, o mapa à direita.*

Pinte com o botão esquerdo e apague com o direito, ou use o preenchimento para
substituir uma área ligada de mosaicos iguais. Os mosaicos vêm do padrão e dos
atributos atuais, ou diretamente da tela.

Guarde como `.zxtm` para continuar a trabalhar – é o formato próprio do PixULA e
guarda tudo – ou como `.zxm`, ou como assembly, C ou binário em bruto para
incluir num programa.

### Elementos do mapa

**Encontrar partes repetidas.** Selecione um bloco da imagem (células inteiras; a seleção é primeiro ajustada a células) e escolha Editar > Procurar elemento do mapa, ou prima Ctrl+F como no ZX Paintbrush. O painel Elementos do mapa abre-se e cada lugar onde o bloco aparece fica contornado na imagem; Anterior e Seguinte percorrem-nos e levam a imagem a cada um. A lista **Correspondência** diz o que quer dizer «igual»: Píxeis e atributos (os píxeis e os bytes de atributo são iguais), Só píxeis (os atributos são ignorados) ou Parece igual (as células mostrariam as mesmas cores nas duas fases do piscar - uma célula vazia corresponde a qualquer célula vazia do mesmo Papel, e uma célula com os píxeis invertidos e a Tinta e o Papel trocados corresponde à original; no GigaScreen e no par Timex cada ecrã é comparado à parte). O Timex hi-res não tem atributos de célula e por isso oferece só as duas últimas. Os lugares que se sobrepõem e os que um elemento anterior já cobre ficam de fora, e a contagem diz quantos. **Aceitar** guarda o elemento com o mapa e cobre os seus lugares com caixas numeradas. Aceitar nunca muda a imagem e não é um passo de anular - Ctrl+Z deixa o elemento em paz; apague-o no painel. A procura funciona onde as células são de 8 por 8 com atributos: Standard, ULAplus, ULANext, GigaScreen e Timex hi-res; noutros sítios diz porque não. Ctrl+F já não abre a procura própria do navegador enquanto trabalha na imagem (o menu do navegador sim). **A lista.** O painel Elementos do mapa enumera cada elemento com Mostrar (contorna os seus lugares e escolhe o seguinte de cada vez) e Apagar (pergunta primeiro; a imagem não muda). **Shift+M**, ou Ver > Imagens dos elementos do mapa, troca as caixas numeradas pela imagem própria de cada elemento, nas cores que a imagem mostra (um par GigaScreen é misturado). Ainda pode desenhar num lugar coberto; os traços ficam escondidos sob a cobertura até apagar o elemento. Novo, Abrir e Nova imagem a partir da seleção perguntam antes de abandonar elementos. **Em ficheiros.** Os elementos são guardados com o mapa (`.zxtm`), com um projeto (`.pixula`) e com a gravação automática de recuperação. Ficheiro > Guardar imagem como > ZXM escreve a imagem juntamente com os seus elementos, como o ZX Paintbrush (só Standard ULA; os elementos de outro modo de ecrã ficam de fora com um aviso), e Ficheiro > Abrir de um `.zxm` traz ambos de volta. O `.zxm` do Editor de mapas continua a conter apenas o seu mapa de mosaicos. Uma procura não pode começar num bloco que um elemento anterior já cobre: um aviso indica esse elemento, e apagá-lo liberta o bloco. Ctrl+Z depois de abrir uma imagem, ou depois de Nova imagem a partir da seleção, traz de volta a imagem anterior com os seus elementos.

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
