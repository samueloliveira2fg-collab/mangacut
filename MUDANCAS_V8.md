# MangaCut Studio 2.0 — V8

## PSD em camadas

- Exportação PSD passou a gravar registros reais de camada e canais RGB/alpha, em vez de uma única imagem composta.
- Preserva nomes Unicode, ordem de empilhamento, hierarquia de grupos, visibilidade, opacidade, offsets, modos de mesclagem mapeados e máscaras raster alinhadas.
- O composto final do documento também é gravado para pré-visualização em aplicativos que leem o composite channel.
- O parser existente é usado em testes de round-trip para conferir a estrutura exportada.
- PSB continua exportando a imagem composta achatada nesta etapa.
- Camadas de texto, ajuste, vetores e Smart Objects ainda não são serializadas como objetos editáveis; o exportador escreve somente rasters e grupos e informa quantas camadas não-raster foram omitidas. A composição visual do documento é incluída como preview; salve em MCUT para preservar esses objetos.

## Decisão de dependência

- ag-psd 34.2.2 foi auditado: MIT, leitura/escrita PSD, suporte a grupos e máscaras raster, com limitações documentadas para modos de cor e gravação de 16/32 bits.
- Não foi incluído como dependência runtime porque o ambiente não conseguiu baixar/verificar o pacote npm. A V8 estende o leitor/escritor PSD nativo já presente no projeto, sem runtime externo.

## Testes

- Teste de round-trip PSD verifica grupos, nomes Unicode, raster, máscara, visibilidade, opacidade e posição.
- `npm test` e `npm run check` executados após a implementação.


V9 amplia o exportador PSD: texto editável do MCUT é rasterizado em camadas PSD; ajustes são incorporados em uma camada composta visível, enquanto as camadas-fonte são preservadas ocultas para não duplicar a imagem. PSB permanece achatado.
