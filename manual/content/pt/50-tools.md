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

{{tools}}
