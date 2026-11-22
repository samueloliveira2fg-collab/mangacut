# MangaCut Studio 2.0 — Roadmap técnico

## Plataforma

- Aplicação web para navegadores de PC.
- Interface otimizada para mouse, teclado e mesa digitalizadora.
- Núcleo próprio; não depende do PhotoCraft.
- Código do projeto sob AGPL-3.0-only.

## Estado da V10

### Incremento concluído nesta etapa
- Importação de máscaras PSD com retângulo independente da camada, incluindo preenchimento pela cor padrão fora da área da máscara.
- Interpretação dos flags de posição relativa à camada, máscara desativada e inversão.
- Corrigido o fluxo de leitura de máscara global PSD para rejeitar com fallback seguro, sem erro interno.
- Testes de regressão adicionados para as geometrias e flags de máscara.

## Estado da V9

### Implementado e incluído
- Documento RGB 8 bits e canvas de composição.
- Árvore de camadas raster/grupos, máscaras raster e blend modes básicos.
- Pincel, borracha, mover, seleção retangular/elíptica, laço, varinha e seleção rápida localizada por cor.
- Inverter e feather de seleção; filtros destrutivos básicos.
- Histórico híbrido com snapshots estruturais e alterações de pixels por tiles para pintura/borracha/Healing.
- Importação de imagens, projeto MCUT v3, canais alfa, adjustment layers básicas e exportação PNG.
- Importação PSD/PSB RGB/grayscale 8-bit com RAW, RLE, ZIP e ZIP Prediction; camadas compatíveis e fallback composto.
- Importação parcial de PSD/PSB em camadas raster: nomes Unicode, limites/offsets, alfa, visibilidade, opacidade, alguns blend modes, grupos básicos e máscaras raster alinhadas.
- Fallback para a imagem composta quando há recursos que o importador ainda não reproduz fielmente.
- Exportação PSD em camadas raster/grupos/máscaras; textos rasterizados e ajustes incorporados ao composto visível com camadas-fonte ocultas. PSB achatado.

### Novos recursos V9
- Compositor síncrono em tiles Canvas 2D de 256 px; superfícies temporárias de máscaras/grupos são limitadas ao tile. As camadas continuam em canvases completos.
- Healing localizado por patch, com correspondência tonal e feather, limitado a 12 MP por camada. Não é content-aware nem IA.
- Transformação livre por handles para escala/rotação, além dos campos de posição, escala e espelhamento.
- Refinamento de seleção por blur e curva de contraste.

### Limitações PSD/PSB atuais
- Sem exportação PSB em camadas; texto exportado como raster; ajustes exportados como composição mesclada visível com fontes ocultas.
- Sem exportação PSB em camadas, CMYK/Lab, profundidade 16/32 bits, ICC, ajustes PSD nativos, clipping, estilos, Smart Objects, texto PSD editável, paths ou máscaras vetoriais.
- Máscaras importadas apenas quando são raster e alinhadas ao tamanho e posição da camada.
- Compatibilidade testada apenas com fixtures sintéticas próprias até que sejam validados arquivos reais em aplicativos externos.

### Próximos módulos por ordem
1. **PSD/PSB round-trip avançado:** ampliar masks/clipping/ajustes e implementar PSB em camadas; validar abrir/salvar/reabrir em Photoshop, GIMP, Krita e Affinity.
2. **PSD avançado:** tratamento de clipping, máscaras fora do alinhamento, adjustment layers, estilos, paths/vetores, texto e Smart Objects por etapas, com fallback se o recurso não estiver implementado.
3. **Motor de documento:** histórico por tiles para pincel/borracha e autosave binário Blob já existem; operações estruturais ainda usam snapshots e autosave ainda regrava o documento completo.
4. **Seleção e máscaras:** refinamento edge-aware, canais PSD reais, seleção por luminância/cor não contígua e integração de segmentação.
5. **Ferramentas:** crop, caneta, formas, texto tipográfico avançado e Healing sem limitação de 12 MP; transformação com alças e Healing por patch já existem.
6. **Renderização:** WebGPU, worker/WASM, cache incremental, mipmaps e armazenamento de pixels por tiles. Compositor Canvas2D síncrono em tiles já existe.
7. **Cor e formatos:** ICC, CMYK/Lab e profundidade 16/32 bits.
8. **IA:** segmentação e seleção de objetos com modelos e licenças documentados.

## Critérios de integração de terceiros

- Verificar licença da release/commit exata e dependências transitivas.
- Preservar copyright, NOTICE e atribuições.
- Não incorporar builds vazadas, código proprietário sem autorização ou arquivos sem proveniência.
- Comparar funcionalidade com testes de referência antes de substituir um módulo próprio.
- Registrar hashes, versão, origem, licença e alterações em `TERCEIROS_E_LICENCAS.md`.

## Testes de qualidade antes de cada release

- Testes automatizados de unidade e regressão.
- Fixtures PSD/PSB de diferentes compressões, modos, nomes, grupos e máscaras.
- Round-trip abrir/salvar/reabrir em MCUT e PSD/PSB.
- Testes de pixels, alpha, máscaras e modos de mesclagem.
- Testes com documentos grandes e perfil de memória.
- Teste real no Chrome e Edge para PC.
- Testes de interoperabilidade em aplicativos externos quando o módulo for implementado.


## V14 — concluído parcialmente

- [x] Retirar bloqueio fixo de 40 MP da importação PSD/PSB e aplicar orçamento de memória estimado.
- [x] Corrigir texto desatualizado do diálogo de novo documento.
- [x] Testes automatizados e smoke test HTTP.
- [ ] Teste interativo completo em Chromium.
- [ ] Bounds locais em toda a arquitetura de camadas e histórico.
