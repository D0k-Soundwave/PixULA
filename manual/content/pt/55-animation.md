## Animação

O PixULA anima de duas maneiras. Uma **animação de ecrã** muda a imagem
inteira de fotograma para fotograma. Uma **animação de sprite** muda um bloco
dela, uma figura a andar ou uma bandeira a ondular, enquanto o resto da imagem
fica parado atrás. Ambas cumprem todas as regras do modo de ecrã: um fotograma
é feito de células de atributos inteiras, por isso nunca divide os atributos
de uma célula.

### Começar uma animação

![O menu Animação](img/menu-animation.png)

![A caixa de diálogo Nova animação de sprite](img/dialog-new-sprite.png)

**Animação > Nova animação de ecrã** faz da imagem o fotograma 1. Cada camada
passa a animada: tem conteúdo próprio em cada fotograma.

**Animação > Nova animação de sprite...** pede um nome, uma largura e uma
altura, uma posição e quantos fotogramas ter no início. O tamanho é arredondado
para cima a células inteiras do modo, e o diálogo diz em que se tornou: no modo
8x1, 20 x 20 passa a 24 x 20. Usar a seleção tira o tamanho e o lugar de uma
seleção. Para pôr o sprite com um clique, selecione primeiro o bloco com a
ferramenta Seleção (Tamanho: Personalizado). **Nova animação de sprite a partir
da seleção** também leva o bloco selecionado para a camada do sprite como
fotograma 1. Uma linha pontilhada logo fora da sua janela mostra onde está.

Uma imagem pode ter várias animações; o seletor no topo do painel Animação
escolhe a que está aberta. O modo de ecrã não pode mudar enquanto a imagem
tiver animações.

### Fotogramas

![O painel Animação com os seis fotogramas de uma bola a saltar](img/animation-panel.png)

O painel Animação mostra cada fotograma em pequeno, com o número e o atraso.
Clique num para ir até ele, ou carregue em `,` e `.` para o fotograma anterior
e o seguinte. Desenha no fotograma mostrado com qualquer ferramenta, tal como
numa imagem parada: o conflito de atributos, os modos de desenho, o Espelho, os
carimbos, o Flash e Desfazer funcionam como sempre.

Adicionar põe um fotograma vazio depois do mostrado e Duplicar uma cópia dele;
Eliminar, Esquerda e Direita eliminam-no e movem-no. O atraso é o tempo que o
fotograma fica no ecrã, em fotogramas do Spectrum de 1/50 s, e Aplicar a todos
dá esse atraso a todos os fotogramas. Para levar parte de um fotograma para o
seguinte, copie-a (**Animação > Fotograma para carimbo** copia a janela de um
sprite), vá ao fotograma seguinte e ponha o carimbo. Desfazer um passo feito
noutro fotograma leva-o de volta a esse fotograma.

**Animação > Carimbos para fotogramas** faz um fotograma novo de cada carimbo
da lista Carimbos, posto onde o carimbo está estacionado; os carimbos ficam.

### Camadas numa animação

![O painel Camadas com uma camada animada, uma partilhada e as duas camadas de pré-visualização do papel vegetal](img/animation-layers.png)

Enquanto há uma animação aberta, cada linha do painel Camadas tem um
interruptor Animada / Partilhada. Uma camada animada tem conteúdo próprio em
cada fotograma; uma partilhada é igual em todos, como um fundo desenhado uma
vez. Tornar uma camada animada copia-a para cada fotograma; torná-la
partilhada mantém o fotograma mostrado, depois de perguntar. As camadas novas
juntam-se à animação aberta, e Fundir para baixo, Fundir selecionadas e
Achatar atuam em cada fotograma.

### Reproduzir

Reproduzir (Enter) reproduz a animação aberta na imagem; um sprite move-se
sobre o seu fundo, e o FLASH e a cintilação GigaScreen continuam. Primeiro,
Anterior, Seguinte e Último percorrem os fotogramas (mantenha Anterior ou
Seguinte premido para continuar), e Parar volta ao fotograma onde começou. Um
clique na imagem ou Escape pausa. Repetir reproduz os fotogramas em ciclo, uma
vez ou em ida e volta. Velocidade reproduz mais depressa ou mais devagar sem
mudar os atrasos, e Reproduzir fotogramas reproduz só uma parte.

### Decalcar fotogramas

**Decalcar** por baixo de um fotograma mostra esse fotograma esbatido enquanto
desenha os outros, como camada de pré-visualização no painel Camadas. O
interruptor **Papel vegetal** mostra da mesma forma o fotograma anterior e o
seguinte, que o acompanham quando muda de fotograma. **Camada > Nova camada de
pré-visualização** junta um deles sozinho.

Uma camada de pré-visualização segue a regra do sistema de camadas: os seus
píxeis de papel e células vazias são transparentes, a tinta das camadas de cima
tapa-a, e vê-se esbatida sobre o que está por baixo. Suba-a ou desça-a para a
pôr por cima ou por baixo da camada onde desenha. Cada uma tem a sua opacidade,
um tom (fotogramas anteriores a vermelho, seguintes a azul) e mostrar ou
ocultar, e eliminá-la tira só a pré-visualização. Uma pré-visualização nunca
faz parte da imagem: nunca se desenha nela, nunca se funde nem se exporta, e
fica oculta durante a reprodução.

### Exportar

**Animação > Exportar animação**:

- **Ecrãs numerados...** guarda cada fotograma como um ecrã Spectrum próprio,
  numerado por ordem (`walk_001.scr`, `walk_002.scr` e assim por diante), em
  qualquer formato de ecrã que o modo saiba guardar. Cada ficheiro é
  exatamente o que Guardar imagem como escreve para esse fotograma. Escolhe o
  nome, o primeiro número, os algarismos e os fotogramas. Se o navegador
  conseguir escrever numa pasta, escolhe uma; senão os ecrãs chegam num só
  `.zip`.
- **GIF animado** reproduz os fotogramas com os seus atrasos, FLASH e
  GigaScreen incluídos.
- **Folha de sprites PNG** põe os fotogramas lado a lado, 16 por linha.
- **SevenuP, todos os fotogramas** escreve até 32 fotogramas num `.sev` (modo
  padrão). Abrir um `.sev` de vários fotogramas faz deles uma animação de
  sprite.
- **Cassete** escreve um SCREEN$ por fotograma num `.tap` ou `.tzx`. Contém os
  ecrãs, não um programa que os reproduza.
- **Sprites Next** escreve uma animação de sprite de 16 x 16 dos modos Layer 2
  e LoRes como folha `.spr`.

As animações são guardadas nos projetos PixULA, no guardado de recuperação e
nas cópias de segurança.
