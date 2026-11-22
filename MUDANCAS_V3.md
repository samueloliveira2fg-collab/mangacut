# MangaCut Studio 2.0 — V4

## Implementado nesta etapa

### PSD / PSB parcial
- Importa a imagem composta achatada (merged composite) de PSD e PSB.
- RGB ou grayscale, 8 bits por canal.
- Compressões RAW, RLE, ZIP e ZIP Prediction.
- Exporta PSD ou PSB achatado em RGB/8 bits com alpha.
- Limite de 40 megapixels e validação de tamanhos/dados antes da alocação.

**Importante:** a V4 não lê nem grava árvore de camadas PSD, grupos, máscaras originais, Smart Objects, textos, estilos ou efeitos. Ao abrir um PSD em camadas, somente a composição mesclada é importada para uma camada raster. Ao exportar, o arquivo tem uma composição achatada.

### Seleção e canais
- Seleção retangular e elíptica.
- Laço poligonal à mão livre.
- Varinha mágica por flood fill contíguo RGB.
- Seleção rápida localizada por cor e raio do pincel.
- Modificadores de seleção: Shift adiciona, Alt subtrai, Ctrl intersecta quando aplicável.
- Inverter seleção e suavizar borda.
- Salvar/restaurar seleções como canais alfa no formato MCUT.

### Camadas de ajuste
- Camada de ajuste não destrutiva de brilho, contraste e saturação.
- Ajuste de opacidade da camada de ajuste.
- Ajustes são aplicados durante a composição e preservados em MCUT v3.

### Projeto e compatibilidade
- MCUT sobe para versão 3 e salva camadas de ajuste e canais alfa.
- Leitura de projetos MCUT anteriores continua suportada (campos ausentes são tratados como opcionais).
- Registro de recursos em `src/features/registry.js` diferencia recursos completos, parciais e planejados.

## Verificações
- `npm test`: 9 testes aprovados.
- `npm run check`: 14 módulos JavaScript passaram em `node --check`.
- Verificação dos elementos HTML usados pelos seletores literais do JavaScript: nenhum ID ausente.
- Servidor HTTP local: arquivos principais e módulos verificados.
- O Chromium headless deste ambiente não produziu DOM antes do timeout; teste gráfico completo permanece pendente no PC do usuário.

## Próxima etapa
- PSD/PSB em camadas: ler/gravar record de camadas, grupos, canais, máscaras, blocos desconhecidos, modos de mesclagem e efeitos.
- Seleção rápida baseada em segmentação mais avançada e refinamento de bordas.
- Máscaras vetoriais e paths.
- Texto vetorial editável.
- WebGPU, workers e processamento em tiles.
