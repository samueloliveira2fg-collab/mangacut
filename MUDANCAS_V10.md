# MangaCut Studio 2.0 — V10

## Foco desta versão: importação de máscaras PSD

- Máscaras raster PSD não precisam mais ter exatamente o mesmo retângulo e posição da camada para serem importadas.
- O parser converte a área independente da máscara para uma superfície local do tamanho do raster da camada.
- Pixels da camada fora do retângulo da máscara recebem a cor padrão declarada pelo PSD.
- Flags de posição relativa à camada, desativação e inversão são interpretados.
- Se houver geometria inválida ou canais especiais não suportados, o parser mantém o fallback para a imagem composta, evitando apresentar uma árvore parcial incorreta.
- Corrigida a leitura de extensões globais da seção Layer and Mask: máscaras globais não suportadas agora acionam fallback controlado em vez de causar ReferenceError interno.

## Testes

- Teste de máscara com retângulo menor que a camada e cor padrão fora da área.
- Teste de máscara relativa à camada com inversão.
- Teste de máscara global não interpretada com fallback seguro.
- Bateria completa: 27 testes aprovados.
- Checagem sintática: 18 módulos aprovados.

## Limitações que permanecem

- Máscaras de grupo ainda não são aplicadas.
- Máscaras vetoriais e recursos PSD especiais continuam fora do escopo.
- A exportação PSD ainda grava máscara raster com geometria alinhada à camada.
- Compatibilidade real precisa ser validada com arquivos PSD/PSB de diferentes editores; testes sintéticos não comprovam compatibilidade universal.
- Prévia visual em navegador não foi validada nesta execução.


## Recuperação de recursos da V12.4 — V11

- Adicionado mapeamento inverso de coordenadas entre documento e raster original da camada, compatível com a ordem de transformações do compositor (deslocamento, escala, rotação e espelhamento).
- Pincel, borracha, carimbo de clonagem e Healing agora convertem os pontos para o espaço local da camada antes de editar pixels.
- Criado módulo isolado `src/core/transforms.js` com conversão direta e inversa, incluindo rejeição de escala zero/inválida.
- Adicionados testes de round-trip para escala não uniforme, rotação, deslocamento, espelhamentos horizontal/vertical e escala inválida.

### Limitações desta recuperação

- Seleção e recorte de seleção ainda são armazenados em coordenadas do documento; a aplicação de seleção sobre camadas transformadas requer conversão da máscara de seleção e permanece pendente.
- O armazenamento das camadas ainda usa canvases do tamanho do documento; a migração para bounds locais e tiles persistentes permanece pendente.
- Exportação PSD Grayscale nativa, PSB em camadas, CMYK/ICC e máscaras de grupo não foram incorporados nesta etapa.
- A integração de IA da V12.4 foi mantida como referência separada; não foi acoplada ao editor sem validação de dependências, licença e fluxo local.

## V12 — seleção transformada e PSD em escala de cinza
- Máscaras de seleção em coordenadas do documento convertidas para espaço local da camada antes de aplicar pincel, clonagem e Healing.
- Healing converte pontos de movimento pela transformação inversa da camada.
- Importação de PSD Gray agora marca o documento como `GRAY`; exportação PSD em camadas grava modo 1 com canais Gray + Alpha e composto correspondente.
- Testes novos: seleção transformada e round-trip PSD cinza.

## V13 — memória, bounds e limite de dimensões
- Adicionado recorte automático por alpha de camadas raster MCUT durante a abertura, preservando `x/y` e aplicando o mesmo retângulo às máscaras.
- Removido limite arbitrário de 40 MP para criação de documentos e abertura de MCUT; mantido máximo de 32.767 px por lado e alerta estimado de memória.
- PSD/PSB mantém limite defensivo de 40 MP nesta versão.
- Testes: 35/35; syntax-check: 19/19. Chromium headless tentou iniciar, mas não concluiu.
