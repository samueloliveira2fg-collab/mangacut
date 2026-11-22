# Terceiros, proveniência e licenças — V10

## Código incluído nesta V10

- Implementação própria em HTML, CSS e JavaScript ES Modules.
- Nenhuma dependência de terceiros incluída em runtime.
- O parser PSD/PSB é um módulo próprio; nenhum arquivo-fonte de terceiros foi copiado.
- Nenhum código, build, asset, fonte ou marca proprietária da Adobe/Photoshop foi incorporado.
- Projeto licenciado sob GNU AGPL-3.0-only; consulte `LICENSE` e o texto oficial em https://www.gnu.org/licenses/agpl-3.0.html.

## Projetos e fontes avaliados, não incorporados

| Projeto/fonte | Licença observada | Uso/decisão |
|---|---|---|
| AdobeDocs/uxp-photoshop-plugin-samples | MIT | Exemplos oficiais de plugins UXP; referência para comandos e UI, não é o motor do Photoshop. Não incorporado. |
| AdobeDocs/uxp-photoshop | Apache-2.0 | Documentação da API UXP. Não incorporada como código. |
| SethRobinson/Patchy | MIT | Editor independente com PSD/PSB e build WASM; arquitetura C++/Qt distinta, não incorporado. |
| Agamnentzar/ag-psd | MIT | Biblioteca PSD/PSB JS/TS; avaliada para integração futura, não incorporada. |
| psd-tools/psd-tools | MIT | Biblioteca Python para leitura/escrita e validação PSD/PSB, não incorporada. |
| IT-BAER/photobaer | AGPL-3.0-only | Editor browser-first, React + Rust/WASM + WebGPU, utiliza ag-psd; candidato mais próximo da arquitetura atual para estudo, mas não incorporado. Seu CLA dá ao mantenedor direitos amplos sobre contribuições enviadas ao repositório. |

A lista, links, análise de limitações e posts específicos do Reddit estão em `PESQUISA_GITHUB_REDDIT.md`. O Reddit foi usado para descobrir projetos e recolher relatos; comentários não comprovam qualidade, licença ou compatibilidade.

## Política de integração

Antes de integrar qualquer projeto: fixar commit/release, conferir a licença do arquivo e da versão exata, guardar copyright/NOTICE, auditar dependências e assets, verificar proveniência, executar análise de segurança, documentar alterações e criar testes de regressão. A licença do repositório não necessariamente cobre imagens, brushes, fonts, modelos, arquivos binários ou dependências vendorizadas.

Código vazado/proprietário sem autorização, builds piratas, conteúdo sem licença clara e materiais de origem duvidosa não serão incorporados. Builds públicas de outros editores são apenas aplicativos independentes; não são código-fonte do Photoshop e não serão tratadas como tal.


## Auditoria adicional V7 — Guazzo e ag-psd

- `vera2077/guazzo`: repositório consultado em 21/11/2026; metadados do GitHub indicam Apache-2.0. Nenhum arquivo-fonte do Guazzo foi copiado nesta V7. Foram adaptados conceitos de dirty-tile undo e armazenamento binário de autosave ao modelo de documento já existente no MangaCut.
- `Agamnentzar/ag-psd`: versão consultada 34.2.2 no `package.json`, licença MIT. A licença ressalva que imagens e brushes do repositório não são cobertos automaticamente. Não foi vendorizado nesta V7; uma integração requer adaptar o modelo e adicionar os avisos da versão efetivamente incorporada.
- `EmilDohne/PhotoshopAPI`: referência C++/Python BSD-3-Clause, não incorporada.
- Não foram incorporados vazamentos, builds proprietárias ou código interno da Adobe.


## ag-psd 34.2.2 — auditoria V8

A biblioteca ag-psd 34.2.2 foi consultada como referência de formato e API; licença MIT segundo npm. Não foi incorporada ao pacote nem vendorizada. O exportador V8 é uma extensão do código PSD nativo do MangaCut. Limitações conhecidas do ag-psd incluem conversão de alguns modos de cor para RGB na leitura, ausência de escrita 16/32 bits e necessidade de o chamador atualizar os dados compostos após mudanças de camadas.


## V10

Os módulos de Healing por patch, refinamento de seleção, compositor em tiles e exportação PSD com texto rasterizado/ajuste composto foram escritos nesta base do MangaCut. Nenhuma dependência externa nova foi introduzida.
