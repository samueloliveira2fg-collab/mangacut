# MangaCut Studio 2.0 — V16

## Cinco blocos desta rodada

1. **PSB em escala de cinza:** exportação PSB achatada agora grava modo Gray (2 canais: Gray + Alpha) quando o documento está em escala de cinza, em vez de forçar RGB.
2. **Preservação de transparência:** a saída Gray mantém o canal Alpha original; a luminância é calculada com ponderação Rec. 709 e validada por reimportação.
3. **Estimativa de memória hierárquica:** a estimativa PSD/PSB agora percorre grupos aninhados e inclui rasters e máscaras dentro deles.
4. **Registro de funcionalidades:** removido identificador duplicado de `clone-stamp`; descrição de exportação foi corrigida para refletir PSB achatado com suporte Gray/RGB.
5. **Regressão automatizada:** adicionados testes para PSB Gray + Alpha, IDs únicos no registro de funcionalidades e estimativa de memória com grupos aninhados.

## Validação

- `npm test`: 46/46 testes aprovados.
- `npm run check`: 19 módulos JavaScript aprovados.
- O teste PSB Gray foi reimportado pelo próprio parser e comparou pixels e alpha.

## Limitações mantidas

- PSB continua sendo exportado como imagem composta achatada; camadas e grupos não são gravados no PSB.
- Exportação PSD em camadas continua limitada ao formato suportado pelo codificador atual.
- A importação PSD/PSB ainda não suporta CMYK/Lab, 16/32 bits, Smart Objects, estilos avançados e todos os tipos de clipping/máscaras.
- Não foi realizado teste interativo completo em Chromium nesta rodada.
