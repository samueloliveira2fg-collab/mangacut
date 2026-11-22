# MangaCut Studio 2.0 — V12

## Três blocos concluídos nesta entrega

1. **Seleção compatível com transformações:** máscara de seleção em coordenadas do documento é convertida para o espaço local da camada antes de limitar pincel, carimbo de clonagem e Healing. Healing também converte os pontos de movimento usando a transformação inversa, incluindo escala, rotação e espelhamento.
2. **Exportação PSD em escala de cinza:** documentos importados em modo Gray mantêm `colorMode: GRAY`; a exportação PSD em camadas grava modo 1, dois canais (Gray + Alpha) por raster e composto Gray + Alpha. A conversão usa luminância ponderada.
3. **Regressão e validação:** adicionados testes de conversão de seleção e round-trip PSD em escala de cinza; mantidos os testes de transformações e exportação RGB.

## Validação

- `npm test`: 32 testes passaram.
- `npm run check`: 19 módulos JavaScript passaram na verificação sintática.
- Teste PSD cinza: cabeçalho (modo 1 / 2 canais), camada e pixels compostos conferidos após reimportação.

## Limitações ainda abertas

- A memória das camadas raster ainda usa canvases do tamanho integral do documento; arquitetura de bounds locais não foi migrada nesta versão.
- O limite de 40 MP para criação/importação de projetos permanece por segurança até que a arquitetura de memória seja substituída e testada.
- Não foi concluído teste interativo de navegador nesta entrega.
- PSB em camadas, CMYK/ICC, máscaras de grupo, canais extras e efeitos avançados continuam incompletos.
