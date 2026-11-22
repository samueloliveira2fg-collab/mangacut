# Auditoria técnica — MangaCut Studio V12.2

**Data:** 17/11/2026
**Base:** MangaCut Studio V12.1, derivada do V12 AnimeSeg enviado pelo usuário.
**Escopo:** correção da hierarquia real de grupos PSD, ordem de registros no exportador, suporte a PSD Grayscale 8-bit e testes com PSDs reais da Biblioteca do usuário. O treinamento da Anime Segmentation continua reservado para outra mensagem.

## Correções desta versão

1. **Importação de grupos:** os registros de camada do PSD são serializados em ordem oposta à pilha visível. O leitor agora percorre os marcadores `lsct` na ordem correta, reconstrói a hierarquia e atribui o `parentId` correto a cada camada.
2. **Nomes de pastas:** remove bytes nulos finais dos nomes lidos.
3. **Exportação:** o escritor agora serializa os registros de camada em ordem bottom-to-top, compatível com a ordem PSD. Isso corrige a inversão dos limites de grupo e a troca de relação pai/filho ao reabrir o PSD.
4. **Grayscale 8-bit:** o importador aceita PSD em escala de cinza e converte cada canal cinza em RGB equivalente dentro do editor. A aparência em tons de cinza é preservada; a exportação editada é RGB 8-bit, não um PSD nativo Grayscale.
5. **Limites:** mantém a remoção dos limites artificiais de 40/120/1.500 camadas e o aviso de RAM, sem fallback silencioso para uma composição achatada.
6. **Versão/UI:** rótulos atualizados para V12.2.

## Testes com os arquivos reais do usuário

Foram encontrados e materializados **54 PSDs individuais**, com tamanho agregado aproximado de 1 GB. Os arquivos originais não foram incluídos no ZIP de entrega para evitar duplicar esse volume.

| Teste | Resultado |
|---|---:|
| Importação completa pelo motor PSD do editor | 54/54 passaram |
| Camadas raster reconhecidas | 470 |
| Pastas/grupos reconhecidos | 55 |
| PSDs achatados automaticamente | 0 |
| Relações de grupo inválidas | 0 |
| Round-trip real (abrir → escrever PSD → reabrir) | 5 arquivos passaram |
| PSD sintético com 1.501 camadas e grupos aninhados | Passou |
| Sintaxe dos 5 blocos JavaScript inline | Passou |
| Testes locais do serviço IA | 2 passaram |

Os cinco round-trips concluídos foram `1.psd`, `2.psd`, `6.psd`, `Gojo Combat.psd` e `Doriutaaaa.psd`. A comparação verifica nomes, parentId, estrutura de pastas, alfa e pixels RGB visíveis. RGB sob pixels totalmente transparentes não é usado como critério, pois pode ser descartado pelo recorte da camada sem alterar a aparência.

`loki puto.psd` passou na importação completa, mas seu round-trip não foi concluído dentro do tempo disponível para essa bateria.

## O que esses testes comprovam — e o que não comprovam

- Os 54 arquivos foram lidos pelo mesmo motor `MangaPSD.read` embutido no site; todos mantiveram a quantidade de camadas raster e nenhuma leitura resultou em fallback achatado.
- Os cinco round-trips confirmam a hierarquia e os pixels visíveis nos casos testados. Isso não comprova fidelidade de todos os efeitos Photoshop, objetos inteligentes, máscaras vetoriais, clipping masks ou canais especiais.
- O teste foi executado diretamente no motor JavaScript do site em Node.js. A verificação visual/interativa completa da interface em navegador não foi concluída neste ambiente, pois a política do navegador bloqueou o acesso local ao arquivo e ao servidor de teste.
- Não foi feita exportação round-trip de todos os 54 arquivos; 49 ainda precisam de round-trip individual, priorizando os PSDs maiores e os que têm máscaras/efeitos.

## Limitações ainda existentes

- **RGB16:** não está integrado ao fluxo de camadas desta versão.
- **PSB:** ainda não implementado. PSD v1 mantém limite de 30.000 px por lado e limites de estrutura do formato.
- **CMYK e modos especiais:** ainda não são suportados pelo importador de camadas.
- **Grayscale:** a importação de Grayscale 8-bit foi adicionada; a edição exporta RGB 8-bit.
- **RAM:** arquivos muito grandes ainda podem exceder a memória disponível no navegador. O editor avisa e pode falhar a operação; não deve achatar ou sobrescrever o original silenciosamente.
- **IA:** serviço local e scripts permanecem; nenhum treinamento personalizado foi iniciado.

## Próximas prioridades

1. Round-trip de todos os PSDs reais, incluindo os arquivos maiores.
2. Teste visual no navegador do usuário, especialmente `ANDANDO DO RIO.psd`, `LEVANTANDO.psd` e `A quanto tempo que não pode-upscaled-2- (1).psd`.
3. Suporte nativo a RGB16, PSB, CMYK e máscaras/efeitos avançados.
4. Criar a aba exclusiva da IA com pincel, restaurar e apagar; treinamento permanece em etapa separada.
