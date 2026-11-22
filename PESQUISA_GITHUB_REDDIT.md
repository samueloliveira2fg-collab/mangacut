# Pesquisa técnica — GitHub, documentação Adobe e Reddit

Data da pesquisa: 21/11/2026

Este levantamento separa código oficial de plugins do Photoshop, implementações independentes e relatos comunitários. **Não foi encontrado um repositório público oficial com o código-fonte interno ou builds de desenvolvimento do Photoshop.** Os repositórios da Adobe localizados são SDKs/documentação e amostras de extensões, não o motor do aplicativo.

## Fontes oficiais da Adobe

### AdobeDocs/uxp-photoshop-plugin-samples

- Link: https://github.com/AdobeDocs/uxp-photoshop-plugin-samples
- Licença mostrada no repositório: MIT.
- Conteúdo: amostras UXP para Photoshop 22+, incluindo plugins de exemplo, criação de camada, painéis, chamadas BatchPlay, exemplos TypeScript/Webpack e uma amostra Rust/WebAssembly.
- Uso técnico possível: estudar ergonomia dos comandos, criação e nomeação de camadas dentro do Photoshop, padrões de UI e a forma como plugins expõem operações.
- Limite: são plugins para executar dentro do Photoshop. Não são o código interno, não implementam o compositor inteiro e não podem simplesmente ser reutilizados como o núcleo do MangaCut.
- Status na V4: consultado, não incorporado.

Documentação oficial: https://developer.adobe.com/photoshop/uxp/2022/guides/code-samples/

### AdobeDocs/uxp-photoshop

- Link: https://github.com/AdobeDocs/uxp-photoshop
- Licença indicada no repositório: Apache-2.0.
- Conteúdo: documentação e exemplos da API UXP, inclusive criar camada, manipular documento e acesso ao sistema de arquivos do ambiente de plugin.
- Status na V4: usado como documentação de referência, não incorporado como código.

## Projetos independentes no GitHub

### SethRobinson/Patchy

- Link: https://github.com/SethRobinson/Patchy
- Licença declarada: MIT (verificar a licença do commit exato antes de qualquer integração futura).
- Conteúdo: editor de imagens independente, com foco em compatibilidade PSD/PSB, camadas, seleções, filtros e build WebAssembly para navegador.
- O que vale estudar: estrutura de documento e camadas, regras de interpretação PSD, testes de compatibilidade, organização de ferramentas e arquitetura wasm.
- Custo de adoção: a implementação é C++/Qt/Emscripten e tem um toolchain e dependências bem diferentes do MangaCut atual, então importar o editor inteiro criaria uma migração grande e não foi escolhido nesta etapa.
- Status na V4: código e documentação consultados; nenhum arquivo do projeto ou build foi incorporado.

### Agamnentzar/ag-psd

- Link: https://github.com/Agamnentzar/ag-psd
- Licença do código indicada no `LICENSE` e no `package.json`: MIT. O próprio repositório avisa que alguns arquivos de imagem/pincéis têm direitos separados e não são automaticamente cobertos pela licença do código.
- Conteúdo: biblioteca JavaScript/TypeScript de leitura e escrita PSD/PSB; útil como referência para estrutura de registros, canais, `luni`, grupos `lsct`, compressão RLE/ZIP e testes.
- Dependências declaradas pela versão consultada: `pako` e `base64-js`; qualquer integração futura exigiria fixar a versão, auditar licenças transitivas e preservar os avisos aplicáveis.
- Status na V4: analisado como possível integração futura; nenhum pacote ou arquivo de código foi incorporado.

### psd-tools

- Link: https://github.com/psd-tools/psd-tools
- Licença: MIT.
- Conteúdo: ferramenta Python para leitura/escrita de estrutura PSD/PSB, extração de camadas e composição parcial de pixels/ajustes.
- Uso possível: ferramenta auxiliar de validação e geração de corpus de testes. Não é uma solução pronta para o runtime do navegador da V4.
- Status na V4: consultado, não incorporado.

### IT-BAER/photobaer

- Link: https://github.com/IT-BAER/photobaer
- Licença declarada: AGPL-3.0.
- Conteúdo: projeto independente de editor no navegador com UI React/TypeScript, engine Rust/WASM e visualização WebGPU com fallback WebGL2. O repositório declara suporte a grupos, máscaras, ajustes, efeitos e Smart Objects; o README também informa que o projeto ainda não chegou à versão 1.0 e que PSDs complexos podem apresentar bugs.
- `package.json` fixa `ag-psd` 31.0.2, além de outras dependências como ONNX Runtime Web e MediaPipe; o engine Rust tem dependências próprias.
- Licença do produto/engine: AGPL-3.0-only. O CLA do mantenedor concede direitos amplos sobre contribuições enviadas ao projeto, incluindo relicenciamento comercial; portanto, não devemos submeter contribuições sem entender esse acordo. O subdiretório `mcp/` tem licença separada MIT.
- Uso possível: é o candidato mais próximo da nossa arquitetura browser-first para estudar o engine Rust/WASM, WebGPU e o fluxo de PSD. Uma migração, porém, exigiria portar a UI/modelo de documento e auditar cada dependência e aviso de terceiros.
- Cautela: a licença AGPL não elimina obrigações de atribuição, disponibilização de fonte quando aplicável ou revisão de dependências. A marca e o logo do projeto não fazem parte da licença do código.
- Status na V4: analisado, não incorporado.

## Reddit: relatos da comunidade

- r/foss, discussão sobre Patchy: https://www.reddit.com/r/foss/comments/1wkv0p9/patchy_an_opensource_photoshoplike_image_editor_i/ . O autor do post avisa que não é afiliado ao projeto e que só tinha começado a testar; ele lista camadas, máscaras, ajustes e PSD/PSB, mas isso é apenas uma impressão inicial de usuário.
- r/SideProject, apresentação de PhotoBaer: https://www.reddit.com/r/SideProject/comments/1wxkp0m/looking_for_testers_photobaer_a_free_opensource/ . É uma publicação do próprio criador pedindo testers; descreve recursos PSD/PSB e engine WASM/WebGPU, mas também reconhece que o projeto é jovem e pode ter bugs com documentos complexos.
- Conclusão do Reddit: útil para descobrir projetos recentes e problemas que usuários comentam; não serve para provar licença, origem de código, qualidade de build ou compatibilidade de arquivos.

## O que foi efetivamente aproveitado na V4

- A arquitetura pública do PSD foi estudada usando documentação e implementações independentes.
- O módulo `src/io/psd.js` foi ampliado com um parser próprio: camada raster, limites, canais RAW/RLE/ZIP/ZIP Prediction, nomes Unicode, visibilidade, opacidade, subset de blend modes, grupos simples e máscaras raster alinhadas.
- Foram adicionados fixtures sintéticos próprios para validar nome Unicode, offsets, ordem, grupos, máscara e RLE.
- Nenhum código-fonte, build, binário, asset, pincel, fonte ou recurso proprietário da Adobe foi copiado ou incluído.
- Nenhum arquivo de Patchy, ag-psd, psd-tools ou PhotoBaer foi copiado para o produto nesta versão.

## Próxima decisão técnica

Para melhorar a compatibilidade PSD sem migrar todo o projeto, comparar o parser próprio com `ag-psd` e `psd-tools` em um conjunto de PSDs de teste próprios e legítimos. Depois decidir se vale integrar uma biblioteca MIT completa ou manter uma camada de compatibilidade própria. Builds do Patchy/PhotoBaer podem ser avaliadas como aplicativos independentes, mas não são builds do Photoshop e não substituem o código-fonte do editor.
