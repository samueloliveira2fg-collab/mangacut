# MangaCut Studio 2.0 — mudanças da V4

## Principal avanço

A V3 abria PSD/PSB apenas pela imagem composta achatada. A V4 adiciona um leitor parcial da seção de camadas do PSD/PSB, mantendo a imagem composta como fallback seguro.

### Importa quando o arquivo usa recursos compatíveis

- Camadas raster RGB/grayscale de 8 bits.
- Dados de canal em RAW, RLE, ZIP e ZIP Prediction.
- Nome de camada em Pascal e nome Unicode (`luni`).
- Retângulo/offset da camada, opacidade e visibilidade.
- Modos comuns que têm equivalente razoável no Canvas 2D.
- Grupos básicos e marcadores de abertura/fechamento (`lsct`/`lsdk`), incluindo modo Pass Through em grupos sem isolamento.
- Máscara raster quando o canal de máscara tem dimensões e posição iguais às da camada.
- Limite estimado de 256 MB para os buffers de descodificação de camadas.

### Fallback que preserva a aparência

Se o PSD tiver clipping, modos não mapeados, intervalos de mesclagem personalizados, blocos de camada que alteram a renderização, camadas especiais sem dados de pixels reconhecíveis, máscaras fora do alinhamento simples, máscaras vetoriais, máscaras de grupo, máscara global ou extensões globais, o importador não finge que reconstruiu corretamente a árvore. Nesse caso, abre a imagem composta achatada e registra a razão em `doc.importInfo.warnings`.

## O que continua parcial

- Exportação PSD/PSB ainda é achatada.
- A V4 não edita texto PSD, Smart Objects, adjustment layers PSD, estilos de camada, clipping, paths/máscaras vetoriais, CMYK/Lab, 16/32 bits ou ICC.
- O parser foi coberto com fixtures sintéticas próprias. Ainda é necessário testar PSDs reais do Photoshop, GIMP, Krita e Affinity para medir compatibilidade.
- A interface gráfica deve ser validada no Chrome/Edge real; o teste Chromium headless do ambiente de construção não foi confiável.

## Pesquisa técnica feita

- Adobe UXP: exemplos oficiais ajudam a estudar comandos, criação de camadas, painéis e integração com o Photoshop, mas são plugins e não o código-fonte do editor.
- Patchy: referência independente para arquitetura de editor, compatibilidade PSD/PSB, grupos, seleção e WebAssembly.
- ag-psd: referência JS/TS para parsing e escrita PSD/PSB, inclusive estrutura de camadas, blocos adicionais, RLE e ZIP.
- psd-tools: referência Python para estrutura de arquivos, camadas e testes comparativos.
- PhotoBaer: referência independente de editor no navegador com WASM/WebGPU.

Nenhum código desses projetos foi incorporado à V4. O parser V4 foi escrito como módulo próprio; não há dependências externas de runtime.
