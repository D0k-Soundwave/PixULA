## Ficheiros

Há duas coisas diferentes que pode guardar, e é importante escolher a certa.

**Um projeto** guarda o seu trabalho tal como o deixou: cada camada, a paleta, o
modo de ecrã, as suas ferramentas e respetivas definições, a imagem de
referência e o sítio para onde estava a olhar. É um ficheiro `.pixula`, escrito
por **Ficheiro > Guardar projeto**, e é o que deve usar enquanto uma imagem
ainda está em curso.

**Uma imagem** é um único ecrã achatado num formato que outro programa entende
– um `.scr` para um emulador, um `.png` para mostrar a alguém, um `.tap` para
carregar em hardware real. **Ficheiro > Guardar imagem como** escreve-os.
Contêm a imagem e mais nada, que é o que quer ao entregar o resultado, e não o
que quer se tenciona continuar a trabalhar nela.

### Importar uma imagem

Ao abrir uma foto ou outra imagem (PNG, JPG, GIF) aparecem três conversões lado a lado - Nítida, Suave e Plana - e clica-se na que se preferir. A Suave é a que transforma tons em píxeis de tinta e de papel, e a lista **Pontilhado** por baixo das pré-visualizações escolhe como: por omissão é o Floyd-Steinberg próprio da importação, e a lista oferece ainda os outros 30 métodos do ZX Paintbrush - limiares, difusão de erro, matrizes de Bayer, pontos agrupados e supercélulas. Escolher um método redesenha a Suave, e também a Nítida depois de escolhido um (a Plana nunca pontilha). Os métodos ordenados continuam através das células de atributos, pelo que o padrão percorre a imagem toda; a difusão de erro fica dentro de cada célula, porque cada célula tem as suas duas cores. Nos modos Layer 2 e LoRes a lista também funciona: cada píxel é colocado entre as suas duas cores de paleta mais próximas e a imagem toda é um só bloco, pelo que a difusão de erro percorre a imagem toda.

### Guardar parte de uma imagem

**Ficheiro > Guardar seleção como** lista os mesmos formatos que Guardar imagem como, cada um aberto só se a seleção lhe servir. PNG, BMP e JPEG aceitam qualquer retângulo. ZXP, SEV, ZED, ASM, C, BIN e ATR aceitam células de atributos inteiras: a seleção é primeiro ajustada às células e a barra de estado di-lo. ColorTiles aceita peças inteiras de 16x16. Os formatos que são um despejo de um ecrã inteiro (SCR, fitas, MLT e semelhantes) só estão abertos quando a seleção é o ecrã inteiro. ASM, C, BIN e ATR escrevem a parte linha a linha: o bitmap como um bloco de bytes por linha, de cima para baixo, e os atributos um byte por célula; fazem-no nos modos clássico, multicolor e ULAplus. Uma seleção à mão livre ou elíptica guarda o seu retângulo envolvente. Um formato fechado diz porquê quando se aponta para ele. Guardar imagem como guarda a imagem toda e ignora a seleção.

### Uma imagem nova a partir de uma seleção

**Editar > Nova imagem a partir da seleção** transforma a seleção na imagem toda. A seleção é primeiro ajustada a células inteiras. Pergunta antes de fazer seja o que for, e Ctrl+Z devolve a imagem antiga. Todas as camadas ficam, cortadas a esse bloco, que passa para o canto superior esquerdo; o resto fica vazio, e o fundo aí é Papel branco. O modo de ecrã mantém-se e a imagem fica sem título, pelo que o próximo Guardar pede um nome.

### Gravação automática e cópias

O PixULA pode guardar o seu trabalho no armazenamento do próprio navegador a
cada poucos minutos e oferecê-lo de volta se uma sessão acabar mal. Está
desligado até escolher a frequência: defina **Gravação automática a cada
(minutos, 0 = desligado)** nas Preferências, em Geral.

Também pode escolher uma pasta no disco, e cada gravação automática escreverá
nela uma versão numerada – `picture V1.pixula`, `picture V2.pixula`, e assim
por diante. A numeração é lida da pasta de cada vez, por isso reabrir uma
imagem continua a sequência em vez de recomeçar em V1, e duas sessões na mesma
imagem partilham um único conjunto de versões. Defina quantas manter nas
Preferências; o valor predefinido é 20.

Uma coisa a esperar. Um navegador não reabre uma pasta escolhida numa sessão
anterior sem a sua confirmação, e o temporizador da gravação automática não a
pode pedir por si. Por isso, a primeira cópia depois de recarregar para e
espera por si. As Preferências têm um botão **Retomar cópias**, e premi-lo é a
confirmação de que o navegador está à espera.

{{formats}}
