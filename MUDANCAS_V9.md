# MangaCut Studio 2.0 — V9

## 1. Healing localizado (J)
- Alt+clique define a origem na camada raster ativa.
- Arrastar transfere textura da origem para o destino.
- Faz correção tonal média entre patch de origem e destino e feather circular nas bordas.
- Respeita a seleção ativa e registra os tiles alterados no histórico híbrido.
- Limite de 12 megapixels por camada para manter uma cópia temporária da camada sob controle.
- Não é content-aware avançado nem preenchimento generativo.

## 2. Transformação livre (Ctrl+T)
- Alças nos cantos e laterais controlam escala X/Y.
- Alça superior controla rotação.
- Shift tenta manter proporção ao escalar.
- Continua disponível ajuste numérico de posição X/Y, escala, rotação e espelhamento no painel.
- Não transforma grupos; a caixa de texto usa limites estimados pela métrica da fonte do navegador.

## 3. Refinamento de seleção
- Novo comando Seleção > Refinar borda.
- Blur ajustável com curva de contraste de borda.
- Mantém a máscara alfa como seleção ativa, respeitando-a no pincel, borracha e Healing.
- Não é refinamento edge-aware ou segmentação IA.

## 4. Compositor Canvas2D em tiles
- Composição full-frame é dividida em superfícies de 256 × 256 px.
- Grupos isolados e máscaras raster criam superfícies temporárias limitadas a um tile.
- Blend modes e ajustes são processados sobre os tiles.
- O armazenamento das camadas continua full-resolution; ainda não há cache incremental, worker, WebGPU ou WASM.

## 5. Exportação PSD
- Text layers MCUT são rasterizadas em camadas PSD, preservando nome, grupo, posição visual, visibilidade, opacidade e blend mode mapeado.
- Se existir camada de ajuste, as camadas originais exportáveis ficam ocultas e uma camada composta visível contém a aparência final. O ajuste não permanece editável no Photoshop.
- Exportação PSB continua achatada.
- Testes verificam que texto vira raster e ajustes viram composto visível com originais ocultos.

## 6. Testes e limitações
- Suite automatizada e checagem de sintaxe listadas em TESTE_E_STATUS.txt.
- Ainda é necessário abrir arquivos no Photoshop/GIMP/Affinity para validação de interoperabilidade; o Chromium headless não completou neste ambiente.
