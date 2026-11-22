# MangaCut Studio 2.0 — V13

## Três blocos desta entrega

1. **Memória / bounds locais:** ao abrir projetos MCUT, camadas raster com transparência externa são recortadas ao menor retângulo que contém pixels visíveis. O deslocamento original é compensado em `x/y`; máscaras acompanham o mesmo recorte. Camadas totalmente vazias e camadas já preenchidas continuam intactas. A importação PSD em camadas já armazenava os rasters usando seus bounds nativos.
2. **Limite de megapixels:** removida a barreira artificial de 40 MP para criação de documentos e abertura de projetos MCUT. Continua existindo o limite técnico de 32.767 px por lado. A interface alerta quando a estimativa básica de uma camada raster atinge 128 MiB. A estimativa é apenas o buffer RGBA de uma camada e não representa o consumo total (histórico, máscaras, composição e navegador aumentam o uso). O parser PSD/PSB mantém sua proteção de 40 MP nesta versão.
3. **Verificação:** novos testes para estimativa de memória, criação acima de 40 MP e recorte alpha. Teste automatizado no Chromium foi tentado, mas o processo do navegador não concluiu neste ambiente; não declarar validação interativa.

## Testes

- `npm test`: 35/35 aprovados.
- `npm run check`: 19 módulos JavaScript aprovados.
- Chromium headless: tentativa sem conclusão por bloqueio/timeout do ambiente.

## Limitações importantes

- Recorte alpha ocorre ao abrir projetos MCUT, após decodificar a imagem original; não reduz o pico de memória durante a decodificação inicial.
- O parser PSD/PSB ainda recusa documentos acima de 40 MP por proteção de memória.
- Criação de documentos muito grandes ainda depende dos limites reais de canvas e memória do navegador; o alerta não garante que qualquer tamanho será suportado.
- Teste manual/interativo no navegador continua pendente.
