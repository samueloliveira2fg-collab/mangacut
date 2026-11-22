# IA local do MangaCut — SkyTNT Anime Segmentation / ISNet

## O que faz

O editor envia uma prévia reduzida (até 1024 px no maior lado) ao serviço local. O serviço executa ISNet via ONNX Runtime e devolve uma máscara PNG em tons de cinza. O MangaCut amplia essa máscara às dimensões do documento e cria uma camada independente. As camadas do PSD de origem não são apagadas.

**O mesmo ISNet pré-treinado é usado para painéis coloridos e P&B.** O seletor de estilo apenas identifica o tipo de exemplo; ele não troca pesos nem ativa um modelo P&B especializado. O comportamento em mangás/HQs P&B será validado e melhorado pelo fine-tuning com pares imagem/máscara corretamente revisados.

## Iniciar no Windows

1. Instale Python 3.10 ou 3.11 (64-bit) e marque `Add Python to PATH`.
2. Abra esta pasta `ai_backend`.
3. Execute `iniciar_ia_windows.bat`.
4. Mantenha a janela preta aberta.
5. Abra `index.html` no navegador, expanda **IA Anime Segmentation** e clique em **Verificar serviço local**.
6. Execute a segmentação. Na primeira execução, o serviço baixa o arquivo ONNX oficial (~176 MB).

O serviço fica limitado a `127.0.0.1:8765`; suas imagens não são enviadas para um servidor externo. Apenas o download inicial do modelo vem do Hugging Face.

## Modelo e integridade

- Repositório: https://github.com/SkyTNT/anime-segmentation
- Modelo: https://huggingface.co/skytnt/anime-seg
- Arquivo ONNX: `isnetis.onnx`
- Revisão travada: `a0a563c41338cbe0d23dfb4bfc3e243c518e5768`
- SHA-256 esperado: `f15622d853e8260172812b657053460e20806f04b9e05147d49af7bed31a6e99`
- Licença indicada na página do modelo: Apache-2.0.

O serviço verifica SHA-256 antes de aceitar o peso padrão. Uma exportação customizada do fine-tuning, se existir, tem prioridade sobre o peso padrão.

## Aceleração

A instalação padrão usa ONNX Runtime CPU. Para tentar aceleração por GPU, precisa de um runtime compatível e respectivos drivers. AMD/Intel no Windows podem testar `onnxruntime-directml`; NVIDIA pode usar `onnxruntime-gpu` conforme CUDA/cuDNN compatíveis. Não instale os dois runtimes simultaneamente sem saber qual provider deve ser usado. `health` informa os providers detectados.

## Limitações conhecidas

- A rede foi treinada para personagem de anime, não para toda arte de HQ/mangá.
- Retículas, balões, traços P&B finos, personagens cortados na borda e fundos com aparência de cabelo/roupa podem exigir retoque manual.
- A máscara é uma previsão inicial suave; não há garantia fixa de precisão.
- O backend não altera PSD diretamente; o editor recebe uma camada nova para revisão.
