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
