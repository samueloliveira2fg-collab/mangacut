# MangaCut Studio 2.0 — V15

## Três blocos desta versão

1. **Exportação PSD sem teto artificial de 40 MP:** o bloqueio fixo foi substituído por estimativa conservadora de pico de memória, mantendo o orçamento de segurança de 512 MB e o limite técnico de 30.000 px por lado do PSD.
2. **Orçamento de memória mais realista:** a estimativa considera composto, canais temporários, camadas raster, máscaras e rasterização de texto; documentos RGB e Gray recebem estimativas diferentes.
3. **Menos alocação duplicada:** exportar PSD em camadas não faz mais uma leitura RGBA completa do composto antes de iniciar a codificação. Essa leitura continua apenas no caminho PSB achatado.

## Validação

- `npm test`: validar todos os testes, incluindo quatro novos testes de estimativa de memória de exportação.
- `npm run check`: verificar sintaxe de todos os módulos.
- O orçamento é uma estimativa conservadora, não uma garantia de que qualquer navegador conseguirá alocar toda a memória disponível.
- PSB continua achatado; exportação PSD continua limitada a 30.000 px por lado e 512 MB estimados.

## Teste no navegador

A página principal respondeu por HTTP no servidor local. A tentativa de execução headless do Chromium não terminou dentro do tempo disponível neste ambiente; portanto, não foi contabilizada como teste interativo aprovado.
