# Auditoria incremental — MangaCut Studio V12.4

**Data:** 17/11/2026  
**Base:** V12.3 — Grayscale nativo  
**Escopo:** corrigir o mapeamento das ferramentas quando uma camada está movida, escalada, girada ou espelhada. A etapa de otimização geral e treinamento da IA ficou deliberadamente fora do escopo.

## Correções implementadas

1. **Coordenadas inversas da camada:** o ponteiro agora é convertido do espaço visível do documento para o espaço original da camada, aplicando a transformação inversa de escala, rotação, espelhamento e deslocamento.
2. **Pincel, borracha, restauração, varinha, conta-gotas e seleção rápida:** passam a receber coordenadas locais corretas após transformação da camada.
3. **Seleção de objeto:** o retângulo visível é convertido para um quadrilátero no espaço da camada; a área analisada fica limitada a esse quadrilátero.
4. **Visualização da máscara:** passa a acompanhar a posição e as transformações da camada.
5. **Contorno da seleção:** o overlay acompanha as transformações em vez de permanecer no espaço anterior da camada.
6. **Cursor do pincel:** diâmetro e orientação visual acompanham escala, proporção e rotação da camada.
7. **Amostragem de coordenadas em lote:** o cálculo da transformação é reutilizado por quadro no overlay e na visualização da máscara, evitando recalculá-lo a cada pixel.

## Testes executados

| Teste | Resultado |
|---|---|
| Sintaxe dos 5 scripts JavaScript inline | PASS |
| Mapeamento identidade + deslocamento | PASS |
| Mapeamento com escala 2× | PASS |
| Mapeamento com rotação de 90° | PASS |
| Mapeamento com espelhamento horizontal | PASS |
| Limites do documento e coordenadas sem clamp | PASS |
| Inspector, seleção de objeto, máscara e overlay ligados à transformação | PASS — verificações de código |
| Fixture PSD com 1.501 camadas e 2 grupos aninhados | PASS |
| Fixture Grayscale nativo com alfa | PASS |
| Importação dos PSDs reais da biblioteca | 54/54 PASS; 470 camadas raster e 55 grupos reconhecidos |
| Round-trip `1.psd` | PASS — 21 camadas, 2 grupos |
| Round-trip `2.psd` | PASS — 17 camadas, 2 grupos |
| Round-trip `6.psd` | PASS — 7 camadas, 2 grupos |
| Round-trip `Gojo Combat.psd` | PASS — 23 camadas, 5 grupos |
| Round-trip `Doriutaaaa.psd` | PASS — 19 camadas, Grayscale nativo |
| Round-trip `loki puto.psd` | PENDENTE — execução ultrapassou o limite de tempo |
| Teste interativo completo no navegador | NÃO EXECUTADO — ambiente de teste bloqueia navegação local |

Os cinco round-trips foram executados individualmente. Uma tentativa de executar a bateria completa de round-trip em um único processo excedeu o limite de tempo; por isso, não é contabilizada como aprovação global.

## Pesquisa externa complementar — candidatos, não incorporados

- **selection-tools (MIT):** conjunto modular de seleção retangular/elíptica, laço, seleção por cor, varinha mágica, máscaras bitmap e contorno animado. Bom candidato para comparar a qualidade da seleção e o comportamento de estado compartilhado; não foi incorporado porque o MangaCut já tem um estado de seleção próprio e a integração precisa ser validada sem quebrar máscara/histórico.
- **magic-wand-js / magic-wand-tool (MIT):** algoritmo clássico de varinha e contorno por tolerância de cor. Útil como referência algorítmica, mas o pacote é antigo; não deve ser copiado sem comparar resultados em retículas, linhas finas e áreas brancas internas.
- **Canvasmith (MIT; Fabric.js também MIT):** editor web com camada headless, pincel, varinha, seleção e histórico. Serve como referência de arquitetura/API; não é um encaixe direto no editor atual.
- **@webtoon/psd (MIT):** parser browser/Node de PSD e PSB, com informação e pixels de camada. É útil como leitor independente para comparar arquivos, mas efeitos ainda estão em desenvolvimento e não substitui um writer.
- **ag-psd (MIT):** candidato mais completo para comparar leitura/escrita PSD em JavaScript. A documentação recente registra suporte a grupos, máscaras, dados brutos/lazy e novos recursos; a versão atual tem limitações específicas em recursos de Photoshop e precisa ser fixada em versão segura e testada antes de qualquer integração. O changelog registra correções recentes de limites de memória e validação de estruturas malformadas.
- **PhotoshopAPI (BSD-3-Clause):** biblioteca C++20/Python para PSD/PSB, grupos, máscaras de pixels, objetos inteligentes, ICC e RGB/CMYK/Grayscale 8/16/32-bit. O projeto se declara em desenvolvimento inicial e os arquivos escritos não incluem uma imagem composta mesclada válida; portanto, não é substituto direto do exportador do MangaCut. É candidato futuro a módulo local de compatibilidade.

## Pendências que permanecem

- Revisar o leitor/escritor PSD para máscaras com bounds independentes, canais extras, perfil ICC, clipping masks, efeitos e camadas fora dos limites do documento.
- Completar a bateria de round-trip dos 54 PSDs, incluindo `loki puto.psd`.
- Validar interativamente no navegador os gestos de pincel, seleção, transformação, histórico e visualização de máscara.
- RGB16/32, PSB e CMYK continuam sem suporte completo no motor atual.
- A refatoração geral de armazenamento de camadas e a otimização ficam para a etapa final combinada com o treinamento da IA.

**Nenhum pacote externo foi incorporado nesta versão.** As referências foram pesquisadas e registradas para evitar adicionar dependências sem comprovar fidelidade, licença e compatibilidade com o projeto.
