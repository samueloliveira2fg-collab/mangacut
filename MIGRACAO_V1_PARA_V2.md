# Migração MangaCut 1.0 (fonte V12.4) → MangaCut Studio 2.0 V21

A fonte V12.4 foi inspecionada diretamente e comparada com a arquitetura modular V20. Esta migração não substitui o motor V2 pela aplicação monolítica antiga: recursos e módulos são portados de forma seletiva para preservar os ganhos de modularidade, memória e testes da V2.

## Portado nesta V21

- `ai/backend/`: serviço local FastAPI + ONNX Runtime ISNet, com bind em `127.0.0.1`, limites de upload/pixels, revisão fixa do modelo e verificação SHA-256 do ONNX oficial.
- `ai/training/`: preparação de dataset supervisionado e script de fine-tuning; depende de pares imagem/máscara revisados e PyTorch compatível com o hardware.
- Auditorias técnicas V12.3/V12.4 e pesquisa complementar preservadas em `legacy/v1-audit/`.
- Fixture real `PSD_V10_roundtrip.psd` preservada e importada pelo parser V2 como documento em camadas (735×630, 5 camadas, sem avisos).
- Registro de funcionalidades atualizado para refletir que backend e pipeline de treinamento existem, mas a interface IA da V2 ainda não está conectada.

## Recursos da lista que já existem na base V2

- Workspaces MangaCut/Photopea-Masks, personalização de painéis, menus e atalhos básicos.
- Pincel, borracha, pressão, seleção retangular/elíptica/laço, varinha e seleção rápida; máscaras raster; grupos e camadas; transformações; autosave/histórico; compositor em tiles.
- RGB/Grayscale 8-bit e importação/exportação parcial PSD/PSB.
- Conversão de coordenadas para camadas transformadas em `src/core/transforms.js`, incluindo escala negativa/espelhamento, rotação e conversão de seleção; coberta por `tests/transforms.test.mjs`.

## Ainda não migrado ou incompleto

- UI de IA ligada ao backend; revisão/aplicação da máscara gerada e fila de processamento.
- Treinamento real: não executado. Os 39 painéis de referência não incluem máscaras rotuladas, então não são dataset supervisionado pronto.
- Caneta e caminhos Bézier editáveis; exportação SVG de paths.
- Object Selection semântica; refinamento edge-aware; preservar especificamente linhas/áreas brancas por modelo/heurística validada.
- Pincéis aerógrafo/nanquim/marcador com presets completos, restauração de pixels e ferramentas de edição/preview de máscara mais avançadas.
- Clipping e máscaras de grupo nativos no parser PSD; recursos PSD avançados, Smart Objects e efeitos.
- ICC real (perfil binário + conversão), RGB16/32 e CMYK.
- WebGPU/WASM/Workers e otimização final de RAM/tiles.
- Testes interativos completos no navegador e bateria de round-trip com os 54 PSDs originais; o ZIP V12.4 não inclui esses 54 arquivos.

## Integridade e segurança

O serviço de inferência permanece local. O download do modelo base ocorre do repositório oficial fixado e é verificado por SHA-256. Modelos fine-tuned são locais e não são baixados automaticamente. Não execute treinamento sem revisar os pares de imagem/máscara e os requisitos de hardware.

## Como iniciar o backend local (Windows)

1. Instale Python 3.10/3.11 64-bit.
2. Entre em `ai/backend/` e execute `iniciar_ia_windows.bat`.
3. O serviço local usa `http://127.0.0.1:8765`; o endpoint `/health` confirma a disponibilidade.
4. A interface V2 ainda precisa da etapa seguinte para enviar a prévia a `/segment` e transformar a resposta em uma máscara não destrutiva.

Consulte `ai/backend/README_IA_LOCAL.md` e `ai/training/` antes de instalar dependências.
