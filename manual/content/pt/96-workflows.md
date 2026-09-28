## Fluxos de trabalho

Algumas tarefas comuns, do princípio ao fim.

### A sua primeira imagem

1. Abra `PixULA.html`. Começa em ULA padrão com um ecrã vazio de 256 por 192.
2. Ative a grelha de células, junto aos controlos de zoom, para ver os blocos
   de 8 por 8 em que a cor é guardada.
3. Escolha uma cor de tinta na barra de cores ou com as teclas 1 a 8, e uma cor
   de papel com um clique direito numa amostra.
4. Desenhe com o **Pincel**. Botão esquerdo para tinta, direito para papel.
5. Faça zoom com `+` e `-`. Mantenha a barra de espaço premida e arraste para
   se deslocar, ou use a ferramenta **Deslocar vista**.
6. `Ctrl+Z` anula. `Ctrl+S` guarda um projeto `.pixula`, que mantém as camadas
   e definições além da imagem.

Definir as áreas de cor antes do pormenor costuma poupar trabalho, porque uma
fronteira de cor que não coincida com uma fronteira de célula vai continuar a
mudar cores que já tinha resolvido.

### Decalcar uma fotografia

1. Abra o painel **Referência** e carregue a fotografia. Fica atrás do desenho
   com a opacidade, a posição e a escala que definir, e nunca faz parte da
   imagem que guarda.
2. Desenhe por cima numa camada normal.
3. Se a referência alguma vez parecer menos nítida do que o original, o painel
   di-lo e oferece um botão **Localizar fotografia**. O PixULA liga ao ficheiro
   no disco, por isso, se a fotografia mudar de sítio, só fica uma pequena
   pré-visualização.

### Converter uma fotografia

Para deixar o PixULA fazer a conversão:

1. **Ficheiro > Carregar**, e escolha um `.png`, `.jpg` ou `.gif`.
2. A janela de importação mostra três conversões lado a lado: Nítido, Suave e
   Plano. Qual fica melhor depende inteiramente da fotografia, por isso vale a
   pena comparar as três de cada vez.
3. Ajuste o brilho, o contraste e a escala até a pré-visualização se ler bem,
   e aceite.

No ULAplus e nos modos Next a paleta é construída a partir da imagem, por isso
não fica limitado às dezasseis cores da ULA. Isso costuma fazer uma grande
diferença.

### Criar um tipo de letra

1. **Ficheiro > Editor de tipos de letra**.
2. Comece pelo tipo de letra ZX ROM, ou importe um conjunto `.ch8` ou `.chr`.
3. Selecione um carácter e edite-o. Há larguras de 4, 6 e 8 píxeis, mas
   estreitar descarta para sempre as colunas da direita, por isso, se estiver a
   experimentar, avance do estreito para o largo.
4. Dê um nome ao tipo de letra para o acrescentar à sua biblioteca.
5. Selecione a ferramenta **Texto**. O seu tipo de letra aparece na lista ao
   lado do ROM. Escreva, posicione o texto e dimensione-o ou rode-o antes de o
   fixar – é redesenhado a partir dos glifos à medida que avança, por isso
   mantém-se nítido em qualquer tamanho.

### Construir um mapa a partir de mosaicos

1. Desenhe na tela as células que quer usar como mosaicos.
2. **Ficheiro > Editor de mapas**, e capture-as para o conjunto de mosaicos.
3. Defina o tamanho do mapa e pinte. O botão esquerdo coloca um mosaico, o
   direito apaga, e o preenchimento substitui uma área ligada de mosaicos
   iguais.
4. Exporte como `.zxtm` para continuar a trabalhar, ou como assembly, C ou
   binário em bruto para usar num programa.

### Desenhar para o ZX Spectrum Next

1. Escolha um modo Next no menu Imagem – Layer 2 com 256, 320 ou 640 de
   largura, ou um dos modos LoRes.
2. Nestes modos não há conflito de atributos; cada píxel tem o seu próprio
   índice de paleta. O que gere é uma paleta de 256 cores de nove bits,
   editada em **Imagem > Editar paleta** e guardada como `.pal` ou `.npl`.
3. Guarde a imagem como `.nxi`, que leva a paleta dentro, ou como `.sl2` para o
   bitmap em bruto.
4. Para sprites, use **Ficheiro > Editor de sprites** e guarde a folha como
   `.spr`.

Pode converter uma imagem clássica para um modo Next e voltar. Voltar implica
ajustar de novo cada célula a duas cores, por isso conte perder pormenor nesse
sentido; o PixULA avisa-o antes de o fazer.

### Levar uma imagem para hardware real

- **Para um emulador**, guarde um `.scr`. É o conteúdo em bruto da memória de
  ecrã do Spectrum, e todos os emuladores o leem. O tamanho exato depende do
  modo de ecrã – a tabela do capítulo sobre modos de ecrã indica-o para cada
  um.
- **Para uma máquina real**, guarde um `.tap` ou `.tzx`. Para acrescentar o seu
  ecrã a uma fita que já contém outros ficheiros, use **Ficheiro > Blocos de
  fita**.
- **Para mostrar a alguém sem Spectrum**, guarde um `.png`.
