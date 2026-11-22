# Pesquisa complementar de código — MangaCut Studio

**Data:** 17/11/2026  
**Escopo desta pesquisa:** ferramentas de seleção, editor web e compatibilidade PSD/PSB. IA e otimização geral foram deixadas para a etapa final, conforme combinado.

## Ferramentas de seleção

### selection-tools — MIT

Repositório: https://github.com/techeclecticdesign/selection-tools

- Seleção retangular e elíptica, laço livre/poligonal, seleção por cor e varinha mágica.
- Estado de seleção compartilhado, máscara bitmap, adicionar/subtrair, contorno animado e extração de pixels selecionados.
- A biblioteca separa coordenadas de visualização e coordenadas nativas, algo útil para o MangaCut.
- Decisão: protótipo de comparação, não integração imediata. Precisamos verificar comportamento com transformação de camada, seleção parcial, máscaras do editor e undo/redo.

### magic-wand-js — MIT

Repositório: https://github.com/Tamersoul/magic-wand-js

- Varinha por diferença de cor, máscara binária e geração de contornos.
- Decisão: referência para comparar algoritmos e contornos; não usar como dependência principal sem teste de bordas finas e retículas.

## Arquitetura de editor web

### Canvasmith — MIT

Repositório: https://github.com/laxmanverma/canvasmith

- Núcleo de edição headless sobre Fabric.js, API pública de ferramentas, histórico, camadas e seleção.
- Decisão: referência de organização do motor e separação entre interface e operações; reescrever o MangaCut sobre Fabric não é necessário e pode comprometer o parser PSD atual.

## PSD/PSB

### ag-psd — MIT

Repositório: https://github.com/Agamnentzar/ag-psd

- Leitor/escritor JavaScript com suporte a muitas estruturas de PSD, grupos, máscaras, efeitos e dados brutos sob demanda.
- Changelog consultado: versão 34.2.x contém correções de segurança/limites de memória e melhorias de recursos; a versão 34.0 adicionou escrita de modos de cor e profundidades maiores em condições específicas.
- Limitações: não é um compositor Photoshop completo; alguns efeitos, textos, padrões e recursos recentes ainda têm restrições. A conversão de dados de imagem pode depender de modo e opção de leitura.
- Decisão: principal candidato para comparação de round-trip; não substituir o motor próprio sem executar o pacote e comparar todos os fixtures reais.

### @webtoon/psd — MIT

Repositório: https://github.com/webtoon/psd

- Parser TypeScript leve, zero-dependency, para browser/Node, com suporte a PSD/PSB, bounds e pixels de camadas.
- Limitações: efeitos ainda em andamento e não é writer PSD; não cobre sozinho todas as exigências de preservação do MangaCut.
- Decisão: possível segundo leitor para diagnóstico de arquivos e comparação de estrutura.

### PhotoshopAPI — BSD-3-Clause

Repositório: https://github.com/EmilDohne/PhotoshopAPI

- C++20/Python; PSD/PSB; grupos aninhados, texto editável, Smart Objects, máscaras de pixels, ICC, RGB/CMYK/Grayscale e 8/16/32 bits.
- Limitações documentadas: projeto ainda em desenvolvimento inicial; arquivos exportados não incluem uma imagem composta mesclada válida para alguns aplicativos que a exigem.
- Decisão: candidato para futuro motor local de leitura/escrita e testes de 16-bit, mas não para exportação final sem corrigir/contornar a composição mesclada.

## Recomendação técnica

1. Manter o parser atual como motor principal enquanto ele passa nos testes reais.
2. Criar uma bateria comparativa automática: parser próprio × ag-psd × @webtoon/psd × PhotoshopAPI quando disponível.
3. Comparar árvore de grupos, bounds, nomes Unicode, canais, máscaras, alpha, modos de mesclagem, pixels e composição.
4. Integrar somente funções isoladas que tenham licença compatível, teste de regressão e ganho comprovado.
5. Não incorporar uma biblioteca inteira só por ter mais recursos: a prioridade é não perder pixels nem estrutura PSD.
