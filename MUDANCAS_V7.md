# MangaCut Studio 2.0 — V7

## Integrações e melhorias desta etapa

- Histórico híbrido inspirado no padrão de dirty-tile undo estudado no Guazzo: operações estruturais continuam usando snapshots; pincel e borracha guardam apenas os tiles 256×256 tocados, com estado anterior e posterior.
- Uma passada de pincel/borracha corresponde a uma única ação de desfazer/refazer, mesmo que tenha muitos eventos de ponteiro.
- A pintura aplica apenas o patch recém-alterado e limpa essa região do buffer temporário, evitando reaplicar o histórico inteiro do traço em cada movimento.
- O painel de status informa quantidade de ações e memória retida aproximada pelo histórico.
- Autosave IndexedDB passa a separar metadados e superfícies raster PNG em objetos Blob, evitando strings base64 gigantes no JSON.
- Leitura retrocompatível dos pontos de recuperação JSON/base64 criados pela V6.
- Mantida a aplicação PC/browser e o formato MCUT.

## O que foi estudado, mas não copiado como módulo pronto

- Guazzo `tile.ts`, `history.ts`, `autosave.ts`, `psd.ts`, `psdexport.ts`, `heal.ts`, `retouch.ts`, `refine.ts` e `transform.ts`. O motor Guazzo depende de um modelo de documento próprio e de dezenas de módulos TypeScript; copiar arquivos isolados criaria incompatibilidades. Foram adaptados os padrões de histórico por tiles e autosave binário ao modelo atual do MangaCut.
- ag-psd 34.x e o bundle vendorizado do Guazzo foram auditados como opção de integração PSD. A biblioteca não foi adicionada nesta V7 porque precisamos primeiro adaptar e testar a conversão do modelo de camadas do MangaCut; não declarar compatibilidade que ainda não existe.
- PhotoshopAPI é C++/Python e permanece referência para pesquisa de PSD/PSB avançado, não dependência do navegador.

## Limitações

- O compositor ainda é Canvas 2D full-frame; tiles são usados no histórico de pintura, não como armazenamento primário de todos os pixels.
- Operações estruturais e filtros ainda usam snapshots completos e estão sujeitos ao orçamento de memória.
- PSD/PSB ainda importa subconjunto e exporta composto achatado.
- Sem Healing, refinamento edge-aware, máscaras vetoriais, Smart Objects, ICC/CMYK/16-bit ou WebGPU nesta versão.
- O antigo arquivo chamado `MangaCut_Studio_2.0_V1_CORRIGIDA.zip` foi inspecionado: o README identifica-o como PhotoCraft v0.23.1 sem alterações funcionais, não como código original do MangaCut V1.

## Verificação

- `npm test`
- `npm run check`
- 17 testes automatizados passaram; `npm run check` validou 17 módulos JavaScript.
- Testes adicionais para desfazer/refazer por tiles e histórico misto.
- HTTP local respondeu 200 para a página, módulos e documentação.
- O teste visual headless no Chromium expirou neste ambiente; validação manual em Chrome/Edge permanece necessária.
