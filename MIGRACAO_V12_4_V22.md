# MangaCut Studio 2.0 V22 — resultados da recuperação V12.4

## O que foi realmente incorporado nesta versão

1. **Fonte histórica preservada:** `legacy/v12.4-source/index.html` e documentação técnica/auditorias ficam dentro do ZIP para comparação e recuperação futura. A aplicação antiga não substitui a arquitetura modular da V2.
2. **39 referências de mangá/HQ:** os arquivos `painel_01` a `painel_39` foram organizados em `assets/reference-panels/` para futura avaliação e anotação. Não são considerados dataset supervisionado sem máscaras rotuladas.
3. **Fixture PSD real:** `tests/fixtures/PSD_V12_4_roundtrip.psd` passa a ser testada pelo parser V2, verificando dimensões e camadas.
4. **Motor vetorial inicial:** `src/tools/paths.js` fornece modelo imutável de caminhos, âncoras, alças de entrada/saída, atualização de nós, amostragem Bézier cúbica e exportação SVG. A interface Pen Tool ainda não está conectada.
5. **Registro de recursos atualizado:** o motor vetorial é marcado como parcial; a interface de edição visual continua planejada.

## O que foi confirmado na auditoria V12.4

- A auditoria histórica relata importação de 54 PSDs com 54/54 resultados positivos no motor V1, incluindo documentos grandes e grupos.
- O relatório de round-trip documenta 5 arquivos testados individualmente (5/5), preservando contagem de camadas, grupos, pixels visíveis e modo de cor. Um sexto arquivo excedeu o limite de tempo naquela rodada.
- Esses números são resultados históricos da V1 e **não** resultados de teste da V2. O pacote V12.4 fornecido contém apenas `PSD_V10_roundtrip.psd` como PSD de teste real; os 54 PSDs originais não vieram no ZIP.

## Direção de produto

A MangaCut 2.0 continua sendo um editor independente com arquitetura própria e fluxo de trabalho profissional inspirado em editores como Photoshop. PhotoCraft não é base visual nem estrutural obrigatória.

## Pendências de integração

- Conectar o motor de caminhos à Pen Tool e ao painel de propriedades.
- Implementar nós selecionáveis, alças arrastáveis, fechamento de caminho e conversão caminho/seleção/máscara.
- Ligar a UI de IA ao backend ISNet já migrado na V21.
- Importar os 54 PSDs de teste originais quando estiverem disponíveis e executar round-trip individual na V2.
