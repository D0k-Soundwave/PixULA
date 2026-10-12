## As ferramentas

A barra agrupa as ferramentas pelo que fazem à imagem: primeiro tudo o que põe
tinta, depois a seleção, depois a guia que a seleção torna possível, depois as
ferramentas que colocam trabalho acabado e, por fim, as que só mudam a sua
vista.

O modo de desenho, o espelho e a guia aplicam-se a todas estas ferramentas, por
isso definem-se uma vez na barra de modos em vez de aparecerem nas opções de
cada ferramenta.

![O painel de opções de ferramenta com as definições do pincel](img/tool-options-brush.png)

*As opções da ferramenta selecionada aparecem neste painel – aqui, o pincel.*

O pincel não tem mira sobre a imagem. A partir do tamanho 2, o contorno da área
que vai pintar é o ponteiro. No tamanho 1 o ponteiro é uma pequena cruz de três
píxeis, e o ponto ao centro é o píxel que o pincel vai pintar, na cor em que o
vai pintar: a sua tinta com BRILHO aplicado, ou a tinta existente da célula
quando a tinta está em «usar a cor existente». Enquanto desenha, o ponto mostra
o que acabou de pintar. Sobre a área cinzenta à volta da imagem volta o
ponteiro normal. Spray, Esbatimento, Padrão e Tracejado funcionam da mesma
forma.

Muitas opções só se aplicam em conjunto com outra. As tabelas abaixo têm uma
coluna **Visível quando** com a condição em que cada linha aparece; as linhas
marcadas «sempre» estão lá seja qual for o resto.

**Figuras de pontos.** A lista de Formas tem um grupo de Figuras, desenhadas colocando pontos: Polilinha, Polígono, Triângulo, Raios, Linha perpendicular e Linha paralela (a tecla L escolhe a ferramenta Figura). Clique para juntar um ponto, ou prima e arraste para um traço livre. Duplo clique ou Enter termina a figura, que fica na imagem como uma pré-visualização ainda alterável; outro Enter desenha-a, num só passo de anular. Retrocesso tira o último ponto (um traço livre inteiro de cada vez), Esc descarta a figura sem desenhar, e clicar noutro sítio ou escolher outra ferramenta desenha-a. O Triângulo, a Linha perpendicular e a Linha paralela terminam sozinhos no terceiro ponto: arraste a primeira linha e clique no último ponto. Uma Linha perpendicular junta uma segunda linha a partir do pé da perpendicular do seu ponto à primeira linha; uma Linha paralela junta uma cópia da primeira com o seu ponto ao meio. Raios liga cada ponto seguinte ao primeiro. O Polígono e o Triângulo podem ser preenchidos. As figuras seguem o modo de desenho, Inverso, as caixas «usar existente», o espelhamento e a guia de desenho como qualquer forma, e a pré-visualização é exatamente o que será desenhado.

**Estilo de linha, Rotação e Arredondamento.** A ferramenta Forma, a ferramenta Figura e a curva de Bézier partilham um Estilo de linha: Contínua, Tracejada, Pontilhada, Traço-ponto, Traço-ponto-ponto e Nenhuma. Os estilos de traços só se desenham numa linha de um píxel, por isso ficam esmaecidos acima da espessura 1; o padrão corre ao longo do contorno, também nos cantos, e cada raio ou linha de uma figura começa o seu. Nenhuma não desenha contorno: use-a com Preenchido para desenhar só o interior. A curva de Bézier não tem Nenhuma. Rotação (de -180 a 180 graus, no sentido horário) roda um retângulo, quadrado, retângulo arredondado, elipse ou paralelogramo em torno do meio da sua caixa, e roda um arco, setor, triângulo, losango ou polígono regular em torno do ponto onde carregou. Arredondamento define quão redondos são os cantos do retângulo arredondado, de cantos retos em 0 a pontas semicirculares em 100. Uma curva de Bézier que ainda está a editar é desenhada quando escolhe outra ferramenta, e Esc descarta-a. A pré-visualização de uma forma ou curva mostra as cópias espelhadas e fica dentro da guia de desenho, como o desenho acabado.

**Editar, mover, rodar e clonar uma figura.** Uma figura acabada e uma curva de Bézier ficam na imagem como pré-visualização até as desenhar. Enquanto esperam, pode arrastar qualquer um dos seus pontos quadrados para as remodelar, arrastar a figura para a mover, arrastar o botão redondo por cima para a rodar e usar as setas para a mover (um píxel, ou uma célula com Shift ou com o ajuste à grelha). Ctrl+Z anula a última destas edições, depois a própria figura e só depois a imagem. Enter, um clique noutro sítio, guardar ou escolher outra ferramenta desenha-a, num só passo de anular. Uma forma da ferramenta Forma normalmente desenha-se ao largar; marque **Manter editável** nas suas opções e ela espera como uma figura, com uma pega em cada ponta do arrastamento. **Editar > Clonar a última figura** (Shift+C) abre uma cópia da última figura, forma ou curva desenhada, pronta a mover, rodar ou alterar; para mudar as cores ou o estilo de linha de uma já desenhada, prima Ctrl+Z e depois Clonar a última figura. Enquanto uma figura espera, segue as cores, o estilo de linha e o preenchimento que escolher, como o desenho acabado. A curva de Bézier é a exceção: reformula-se pelas suas pegas e move-se com as setas, mas não se pode arrastar inteira nem rodar, e Ctrl+Z descarta a curva toda de uma vez.

**Spray com padrão.** Ponha a Distribuição do spray em **Padrão** e ele coloca pequenas figuras inteiras - círculos, quadrados ou traços curtos - em vez de pontos. Escolha a figura, o tamanho e se é cheia ou só contorno; o Fluxo diz que parte da área tentam cobrir. Só são colocadas figuras inteiras dentro da área, por isso um spray pequeno demais para uma figura não desenha nada.

**O ajuste e o seu passo.** O ajuste (o botão sob a tela, ou Shift+S) faz as seleções, formas, pontos de figura, texto e peças coladas caírem numa grelha; o desenho à mão livre nunca é ajustado. A lista junto ao botão define a grelha: a célula de atributos do modo (8x8, ou 8x4, 8x2 ou 8x1 nos modos multicolor), 16x16, um ecrã inteiro de 256x192 (só numa tela maior que um ecrã, como Layer 2 320 e 640) ou o seu passo, cuja largura e altura define nas Preferências, em Desenho. Escolher um passo também liga o ajuste. Uma peça colada cai com o canto superior esquerdo na grelha. Com o ajuste ligado, as setas movem um passo uma figura em espera, uma peça flutuante ou a ponta do gradiente; uma seleção que leva as suas cores move-se o passo arredondado a células inteiras. O ZX Paintbrush move com o teclado pixel a pixel seja qual for o seu salto de trama, por isso isto difere de propósito.

{{tools}}
