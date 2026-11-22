# MangaCut Studio 2.0 — V14

## Três blocos desta entrega

1. **Importação PSD/PSB acima de 40 MP:** removido o bloqueio fixo de 40 MP no importador. A decodificação agora usa estimativa de memória para canais do composto + saída RGBA e cobra a estimativa das camadas no mesmo orçamento. O limite de segurança é 512 MB estimados; camadas que excedem o orçamento caem para o composto quando ele ainda cabe no orçamento.
2. **Interface coerente:** corrigido o texto antigo do diálogo de novo documento que ainda anunciava o teto de 40 MP, removido nas versões anteriores. Atualizado o título para V14.
3. **Validação e testes:** adicionados testes para importação acima de 40 MP, estimativa do orçamento e bloqueio preventivo de arquivos que excedem 512 MiB. Servidor HTTP local respondeu 200 e serviu a página. Chromium headless foi tentado em dois modos, mas travou antes de produzir DOM; portanto a validação interativa no navegador continua pendente.

## Resultados

- `npm test`: 38/38 testes aprovados.
- `npm run check`: 19/19 módulos JavaScript aprovados.
- HTTP local: `index.html` respondeu 200 OK.
- ZIP: validado após empacotamento.

## Limites e observações

- O orçamento de 512 MiB é uma estimativa mínima, não uma medição da RAM livre. O navegador, histórico, canvas, máscaras e imagens comprimidas podem elevar o pico real.
- Exportação PSD continua limitada a 40 MP e 30.000 px por lado nesta versão; exportação PSB continua achatada.
- O importador PSD/PSB ainda suporta apenas RGB/Grayscale de 8 bits, com fallback composto quando há recursos especiais não reproduzidos.
- O teste interativo completo em Chromium não foi concluído neste ambiente.
- A arquitetura geral ainda mantém canvases de documento completo em várias operações; bounds locais completos seguem como trabalho futuro.
