# MangaCut Studio 2.0 — V18

## Cinco blocos implementados

1. **Exportação PSB em camadas:** PSB agora usa o mesmo construtor de estrutura de camadas do PSD, com cabeçalho de versão 2 e campos de comprimento de 64 bits para a seção Layer and Mask e dados de canais. O fluxo principal de exportação também foi conectado ao encoder em camadas.
2. **Preservação de grupos e máscaras raster:** o round-trip PSB valida grupos aninhados, nomes Unicode, visibilidade, opacidade, modo de mesclagem e máscaras raster de camada.
3. **Metadados do documento MCUT v4:** arquivos de projeto agora preservam metadados, guias, grade e perfil de cor declarado, mantendo leitura retrocompatível de campos ausentes.
4. **Recuperação automática:** o ponto de recuperação IndexedDB também salva e restaura metadados, guias, grade e perfil de cor.
5. **Histórico e snapshots:** corrigido um problema em que `cloneDocument` descartava metadados e guias; undo/redo agora mantém esses dados com cópias independentes.

## Validação

- `npm test`: 54/54 testes aprovados.
- `npm run check`: 19/19 módulos JavaScript aprovados.
- Teste novo de PSB em camadas reimporta o arquivo e verifica grupos, máscara, Unicode e visibilidade.
- Testes MCUT verificam round-trip de metadados; testes de histórico verificam preservação em undo.

## Limitações conhecidas

- Máscaras aplicadas diretamente a grupos PSD/PSB ainda não são renderizadas/importadas; o parser usa fallback composto quando encontra esse recurso.
- PSB em camadas suporta o subconjunto atual de recursos do editor; não equivale a compatibilidade integral com todos os recursos proprietários do Photoshop.
- O perfil de cor é preservado como metadado do projeto, mas ainda não há conversão ICC de pixels.
- Não foi executado teste interativo completo em navegador nesta rodada.
