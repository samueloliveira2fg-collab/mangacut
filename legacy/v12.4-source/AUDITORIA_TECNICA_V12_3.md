# Auditoria incremental — MangaCut Studio V12.3 (Grayscale nativo)

**Data:** 17/11/2026  
**Base:** V12.2  
**Escopo desta rodada:** comparar bibliotecas PSD candidatas, repetir testes de regressão e corrigir exportação nativa Grayscale 8-bit.

## Mudanças implementadas

1. O leitor agora devolve `colorMode` e `depth` ao documento, em vez de descartar o modo de cor depois da leitura.
2. O documento mantém o modo original RGB (3) ou Grayscale (1) durante a edição.
3. O exportador de camadas grava PSD Grayscale nativo com 1 componente de cinza e canal alfa opcional, header com `color mode = 1`, profundidade 8-bit e contagem correta de canais.
4. O composto também é escrito como planos grayscale + alpha, em vez de sempre RGB.
5. Em documentos `.mcut`, o modo de cor é salvo e restaurado. Imagens comuns importadas continuam RGB.
6. Se o usuário pintar com cor em um documento Grayscale, a saída é convertida para luminância ao exportar; tons de cinza existentes mantêm os valores originais.

## Testes executados

| Teste | Resultado |
|---|---:|
| Sintaxe dos scripts JavaScript inline | PASS |
| Fixture de 1.501 camadas + 2 pastas aninhadas | PASS |
| Importação dos 54 PSDs da biblioteca | 54/54 PASS |
| Round-trip `1.psd` | PASS — 21 camadas, 2 grupos, RGB |
| Round-trip `2.psd` | PASS — 17 camadas, 2 grupos, RGB |
| Round-trip `6.psd` | PASS — 7 camadas, 2 grupos, RGB |
| Round-trip `Gojo Combat.psd` | PASS — 23 camadas, 5 grupos, RGB |
| Round-trip `Doriutaaaa.psd` | PASS — 19 camadas, Grayscale nativo preservado |
| Fixture sintético Grayscale + alpha | PASS — modo 1, 2 canais, pixels e alfa preservados |
| Round-trip `loki puto.psd` | PENDENTE — ultrapassou 90 s nesta execução |
| Teste interativo completo no Chromium | BLOQUEADO — ambiente bloqueou navegação local e localhost (`ERR_BLOCKED_BY_ADMINISTRATOR`) |

## Problema de desempenho confirmado

O leitor atual aloca um buffer RGBA do tamanho total do documento para **cada camada**, mesmo quando a camada ocupa apenas uma pequena área. Isso cria pressão de memória desnecessária.

- `Doriutaaaa.psd`: 19 camadas, estimativa aproximada de 1.217 MiB em buffers RGBA de tela inteira; pelas caixas delimitadoras das camadas, cerca de 108 MiB seriam suficientes para os pixels de camada.
- `loki puto.psd`: 17 camadas, estimativa aproximada de 1.071 MiB em buffers de tela inteira; pelas caixas delimitadoras, cerca de 263 MiB seriam suficientes.

O cálculo é uma estimativa de armazenamento bruto RGBA e não inclui prévia, máscaras, arrays temporários ou overhead do navegador. A próxima correção estrutural deve guardar pixels recortados com `x/y/width/height` e adaptar o renderizador para desenhar cada camada na posição correta. Não foi alterado nesta rodada porque exige uma mudança maior no modelo de camada e nos testes de ferramentas.

## Comparação dos projetos externos

- **ag-psd (MIT):** candidato mais útil para leitura/escrita PSD no navegador e para comparar suporte a grupos, máscaras e canais. A documentação npm atual informa escrita em Grayscale e RGB, mas sem escrita 16/32 bpc; leitura 16/32 bpc é suportada. A leitura converte os modos suportados para RGB, então não deve substituir o estado de cor nativo sem uma camada de preservação própria.
- **psd-tools (MIT):** bom para validação e manipulação de baixo nível PSD/PSB; composição e edição de tipos avançados têm limitações. Melhor como ferramenta de QA/diagnóstico do que como motor único do editor.
- **psd-tools2 (MIT):** validador promissor de leitura para Grayscale/RGB/CMYK 8/16/32-bit e ICC/PSB; não implementa escrita PSD.
- **psd-reader (MIT):** leitor de browser com decodificação assíncrona segmentada e acesso a canais nativos; não lê a hierarquia completa das camadas, portanto é útil como referência para parser de imagem/canais, não como substituto de PSD editor.
- **OpenPSD (MIT):** leitor C multiplataforma de PSD/PSB, com grupos e decodificação lazy de pixels; não é um writer PSD completo. Pode servir como validador independente ou futuro módulo nativo.

**Limitação de verificação:** os projetos externos foram comparados pelas documentações e repositórios públicos. A tentativa de obter o pacote `ag-psd` diretamente pelo gerenciador de pacotes excedeu o tempo disponível; nenhum código externo foi copiado ou declarado testado em execução. A correção Grayscale desta versão foi implementada no writer próprio do MangaCut e testada com fixture sintético e um PSD Grayscale real.

## Próximas prioridades

1. Refatorar camadas para pixels recortados e coordenadas, eliminando buffers de tela inteira por camada.
2. Finalizar round-trip de `loki puto.psd` e os 49 PSDs ainda sem round-trip individual.
3. Comparar a saída do MangaCut com `ag-psd` e `psd-tools` quando os pacotes puderem ser obtidos e executados localmente.
4. Preservar canais extras, perfil ICC e metadados no round-trip editado.
5. Depois disso, avançar para RGB16, PSB e CMYK sem prometer suporte antes dos testes.
