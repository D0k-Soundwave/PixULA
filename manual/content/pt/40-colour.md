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

### Modos de desenho

O modo de desenho muda o que faz um traço, e aplica-se a todas as ferramentas.
Mantém-se entre sessões, por isso a barra de estado mostra-o sempre que não é
Normal – em alguns destes modos um traço não deixa nada visível, e de outro
modo não teria forma de saber porquê.

{{draw-modes}}

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
