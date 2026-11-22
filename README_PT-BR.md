# MangaCut Studio 2.0 — Photoshop Edition (V23)

Editor independente para navegador de PC, organizado em módulos e distribuído sob GNU AGPL-3.0-only. Esta é uma base de desenvolvimento com interface e ferramentas próprias. Não é uma cópia do código interno do Photoshop.

## Executar no Windows

1. Extraia o ZIP completo.
2. Instale Python 3 e confirme que `py` ou `python` funciona no terminal.
3. Dê dois cliques em `INICIAR_MANGACUT.bat`.
4. O navegador abrirá `http://localhost:8765`.
5. Mantenha o servidor local aberto enquanto usar o editor.

Alternativa manual na pasta do projeto:

```bash
python -m http.server 8765 --bind 127.0.0.1
```

## Recursos funcionais nesta V10

- Criar documentos RGB/8 bits com fundo transparente, branco ou preto (limitado pelas dimensões técnicas do navegador e pela memória disponível).
- Abrir PNG, JPEG, WebP, GIF, BMP e AVIF quando o navegador suportar a decodificação.
- Importar múltiplas imagens como camadas.
- Camadas raster e grupos com organização hierárquica simples.
- Visibilidade, renomeação, duplicação, exclusão, reordenação e mesclagem de camadas.
- Opacidade e modos de mesclagem suportados pelo Canvas 2D.
- Máscara raster por camada; pintar branco revela e apagar/preto oculta.
- Pincel, borracha, carimbo de clonagem (Alt+clique define origem), Healing localizado por patch (J; Alt+clique define origem), mover, transformação livre por alças (Ctrl+T), texto editável básico, seleção retangular, elíptica, laço, varinha mágica e seleção rápida localizada por cor.
- A seleção restringe traços e Healing; inverter, suavizar e refinar bordas com desfoque e curva de contraste.
- Histórico híbrido: operações estruturais por snapshots e pincel/borracha por tiles alterados de 256 px.
- Filtros destrutivos iniciais: escala de cinza, inverter, brilho e desfoque aproximado.
- Zoom, ajuste à tela, navegação com espaço, arrastar e soltar.
- Projeto MCUT v3 (JSON + PNG embutidos), com canais alfa e camadas de ajuste persistidos; mantém compatibilidade de leitura com MCUT v2.
- Importação PSD/PSB RGB ou grayscale de 8 bits: imagem composta e uma faixa de camadas raster compatíveis, com compressões RAW, RLE, ZIP e ZIP Prediction.
- Leitura parcial de nomes Unicode, posições, visibilidade, opacidade, alguns modos de mesclagem, grupos básicos e máscaras raster. A V10 converte máscaras com retângulo/posição independentes para uma máscara local do tamanho da camada, respeitando cor padrão, posição relativa e inversão.
- Fallback automático para a imagem composta quando há recursos ainda não suportados, para evitar importar uma árvore parcial com aparência incorreta.
- Exportação PSD RGB/8-bit com camadas raster, grupos, nomes Unicode, offsets, opacidade, visibilidade, modos de mesclagem mapeados e máscaras raster alinhadas; texto é rasterizado. Quando há camadas de ajuste, o composto final é salvo como camada visível e as fontes originais ficam ocultas. PSB permanece achatado.
- Camadas de ajuste não destrutivas de brilho, contraste e saturação, incluindo opacidade; também sépia, limiar e posterização.
- Interface modular em ES Modules, sem dependências externas de runtime.

- Carimbo de clonagem: origem definida com Alt+clique na camada raster ativa; pintura copia pixels com tamanho/opacidade do pincel e respeita seleção.
- Healing localizado: usa amostra definida com Alt+clique, transfere textura com correspondência tonal média, suavização circular e respeito à seleção. É um retoque por patch, não é preenchimento generativo nem um algoritmo content-aware equivalente ao Photoshop.
- Camadas de texto editáveis básicas: texto, família, peso, tamanho, cor e conteúdo alteráveis sem rasterizar. A fonte é desenhada pelo navegador e pode variar entre sistemas.
- Transformação por camada raster/texto: posição X/Y, escala independente, rotação e espelhamento horizontal/vertical. A ferramenta Ctrl+T adiciona alças para escala e rotação; posição precisa ainda é ajustada no painel.
- Autosave local com IndexedDB, superfícies PNG em Blob e recuperação retrocompatível da V6.
- Histórico híbrido: snapshots para operações estruturais e tiles alterados para pincel/borracha/Healing, reduzindo a memória de desfazer/refazer nos traços.

## Estrutura dos módulos

- `src/core/`: estado, modelo do documento, grupos, camadas, máscaras e histórico.
- `src/render/`: compositor de camadas, grupos, opacidade, máscaras e blend modes.
- `src/tools/`: pintura, borracha, carimbo, Healing localizado, seleções e filtros iniciais.
- `src/io/`: importação de imagens, parser PSD/PSB, exportação PNG e serialização MCUT.
- `src/ui/`: painel de camadas e menus.
- `src/features/`: registro do que está implementado e do que ainda está planejado.
- `tests/`: testes automatizados do histórico, projeto MCUT e parser PSD/PSB.

## Atalhos

- `V`: mover; `P`: Caneta vetorial; `M`: seleção retangular; `W`: varinha mágica; `J`: Healing; `Ctrl+T`: transformação livre.
- `B`: pincel; `E`: borracha; `T`: texto; `H` ou `Espaço`: mão.
- `O`: seleção elíptica; `L`: laço; `Q`: seleção rápida.
- `Ctrl+O`: abrir imagem/PSD; `Ctrl+Z`: desfazer; `Ctrl+Y`: refazer.
- `Ctrl+Shift+S`: salvar MCUT; `Ctrl+Alt+Shift+S`: exportar PNG. PSD e PSB ficam disponíveis no menu Arquivo.
- `[` e `]`: diminuir/aumentar o pincel.

## Limitações explícitas

- **Importação PSD/PSB parcial:** funciona com RGB/grayscale de 8 bits, canais raster RAW/RLE/ZIP/ZIP Prediction, nomes Unicode, offsets, opacidade, visibilidade, um conjunto de modos de mesclagem, grupos básicos e máscaras raster alinhadas ou com geometria independente (convertidas para o espaço local da camada). A compatibilidade é parcial e ainda precisa ser verificada com PSDs reais produzidos por diferentes aplicativos.
- Se o arquivo tiver clipping, intervalos de mesclagem personalizados, máscaras vetoriais, máscaras fora da geometria da camada, máscaras de grupo, blocos globais, ajustes, efeitos ou outros recursos que possam mudar a aparência, o MangaCut abre a imagem composta achatada como fallback.
- **Exportação PSD em camadas, com limites:** grava rasters, grupos e máscaras raster alinhadas. Texto vira raster. Se houver ajustes, os rasters/grupos-fonte ficam ocultos e o composto com os ajustes é salvo como camada visível; os ajustes não permanecem editáveis. PSB permanece achatado. Salve em MCUT para preservar integralmente a estrutura do MangaCut.
- Sem CMYK, Lab, Indexed, 16/32 bits, perfis ICC ou gerenciamento de cor avançado no módulo PSD.
- O texto editável existe apenas no formato MCUT; a exportação PSD rasteriza os textos em camadas de bitmap, sem manter edição tipográfica nativa. Ainda não há edição tipográfica avançada, fontes incorporadas, texto em caminho ou texto PSD nativo. Smart Objects, clipping masks, efeitos de camada avançados, máscaras vetoriais e adjustment layers PSD nativas seguem pendentes.
- O importador de camadas tem orçamento estimado de 256 MB para os buffers de descodificação; quando ultrapassa esse valor, usa a imagem composta para proteger a memória.
- Varinha mágica e seleção rápida usam flood fill por distância RGB e ficam limitadas a 12 megapixels. O refinamento atual usa blur e curva de contraste, sem análise semântica ou edge-aware. Não equivalem aos algoritmos inteligentes do Photoshop.
- Operações estruturais e filtros ainda salvam snapshots completos e podem consumir memória; traços de pincel/borracha guardam apenas tiles tocados. Não há teto artificial de megapixels para documentos; os limites reais de memória e do navegador continuam valendo.
- O autosave depende do espaço disponível no armazenamento local do navegador; limpe dados do site apenas sabendo que isso remove pontos de recuperação.
- O histórico por tiles nesta versão cobre pincel, borracha e Healing; operações estruturais e filtros ainda usam snapshots completos.
- O compositor agora recompõe a imagem em superfícies Canvas 2D de 256 × 256 px para limitar buffers temporários; os documentos e suas camadas continuam armazenados em canvases de resolução completa. A renderização ainda é síncrona na thread principal. WebGPU, WASM e Workers seguem pendentes.
- O desfoque atual é aproximado e destrutivo. O Healing exige cópia temporária da camada ativa e fica limitado a 12 megapixels por camada nesta versão.

## Licença AGPL-3.0-only

Este projeto declara GNU AGPL versão 3, somente essa versão. Consulte `LICENSE` e o texto oficial em https://www.gnu.org/licenses/agpl-3.0.html. Se uma versão modificada for disponibilizada para interação remota por rede, a seção 13 exige oferecer aos usuários remotos acesso gratuito ao Corresponding Source dessa versão. Este texto é informação sobre a licença, não aconselhamento jurídico.

## Proveniência

O projeto é uma implementação independente, escrita para o MangaCut Studio. Nenhum código, build, asset, fonte ou marca proprietária da Adobe/Photoshop foi incorporado. Nenhum arquivo-fonte de Patchy, ag-psd, psd-tools, PhotoBaer ou Guazzo foi copiado para o produto. Guazzo foi consultado como referência arquitetural; consulte `PESQUISA_GITHUB_REDDIT.md` e `TERCEIROS_E_LICENCAS.md`.


## V11 — recuperação de coordenadas transformadas

A V11 corrige o mapeamento de pontos para pincel, borracha, carimbo e Healing em camadas raster movidas, escaladas, giradas ou espelhadas. O mapeamento é coberto por testes matemáticos automatizados. A seleção em camadas transformadas e a migração de memória por bounds locais continuam no próximo bloco de trabalho.

## MangaCut Studio 2.0 V12

A V12 corrige o recorte de seleções em camadas transformadas para pincel, clone e Healing, e habilita exportação PSD em escala de cinza com camadas e canais Gray + Alpha. Consulte `RELEASE_V12.md` para testes e limitações.

## V13 — bounds locais e memória
- Camadas MCUT com transparência externa são recortadas aos pixels visíveis durante a abertura, compensando os offsets e recortando a máscara junto.
- A barreira artificial de 40 MP foi removida para novos documentos e projetos MCUT. O limite técnico por lado é 32.767 px; o parser PSD/PSB usa orçamento estimado de memória para o composto e as camadas.
- A interface mostra aviso para estimativas de pelo menos 128 MiB por camada raster. O valor não inclui histórico, máscaras, composição ou outros custos do navegador.
- Validação: 35 testes e 19 módulos JS. Chromium headless não concluiu no ambiente de build.


## V14

- O importador PSD/PSB não tem mais bloqueio fixo de 40 MP: usa estimativa de memória de até 512 MiB para o composto e camadas. Esse orçamento é uma proteção conservadora, não garantia de que o navegador tenha RAM disponível.
- Exportação PSD continua com limite próprio de 40 MP; PSB continua achatado.
- Ver `RELEASE_V14.md` para testes e limitações desta versão.

### V15 — exportação com orçamento de memória

A exportação PSD não usa mais um corte fixo de 40 MP. Antes de alocar canais e buffers, estima o pico de memória para composto, camadas, máscaras e texto, com orçamento de 512 MB. A exportação PSD em camadas também evita uma leitura RGBA redundante do composto. PSB permanece achatado nesta versão.

### V16 — PSB Gray, memória hierárquica e registro

- PSB achatado preserva documentos Gray como Gray + Alpha; RGB continua RGB + Alpha.
- Estimativa de memória de exportação percorre camadas dentro de grupos aninhados.
- Registro de funcionalidades sem IDs duplicados.
- Consulte `RELEASE_V16.md` para validação e limitações.

### V17 — robustez de hierarquia e máscaras PSD

- Estimativa de memória percorre hierarquias aninhadas e rejeita IDs duplicados, pais inexistentes e ciclos.
- Grupos PSD com marcadores inconsistentes usam fallback composto.
- Máscaras ativas com geometria inválida usam fallback seguro; máscaras desativadas não são decodificadas.
- Consulte `RELEASE_V17.md` para os 51 testes e limitações.

### V18 — PSB em camadas e integridade do projeto

- PSB passa a exportar camadas e grupos, com comprimentos de seção/canais no formato PSB e reimportação testada.
- MCUT v4 preserva metadados, guias, grade e identificação do perfil de cor.
- Recuperação automática e snapshots de histórico preservam os novos metadados.
- Limitações: máscaras de grupo e conversão ICC ainda não são suportadas. Veja `RELEASE_V18.md`.

### V19 — robustez PSB, histórico e fallback PSD

- Parser PSB lê tamanhos de canal de 64 bits com validação de faixa segura.
- Estimativa de memória do histórico inclui rasters dentro de grupos e rejeita hierarquias inválidas.
- Máscaras de grupo e clipping PSD são identificados e direcionados ao fallback composto para preservar a aparência.
- Consulte `RELEASE_V19.md` para resultados e limitações.

### V20 — recursos ICC e diagnósticos de compatibilidade

- Detecta perfil ICC incorporado em recursos PSD/PSB e registra a identificação no documento importado, sem alegar conversão de cores.
- Valida comprimentos/assinaturas de recursos antes da leitura.
- Mantém fallback composto seguro para máscaras de grupo, clipping e flags avançadas desconhecidas de máscara.
- Consulte `RELEASE_V20.md` para os 60 testes e limitações.

### V21 — migração seletiva da MangaCut 1.0 (V12.4)

- Migrados backend local ISNet/ONNX e pipeline de preparação/fine-tuning para `ai/`.
- Adicionada fixture PSD real da V1; o parser V2 importa suas 5 camadas sem fallback.
- Auditorias e pesquisa da V1 preservadas em `legacy/v1-audit/`.
- A interface de IA ainda não está conectada ao backend; consulte `MIGRACAO_V1_PARA_V2.md` para a matriz completa de recursos já existentes, portados e pendentes.

### V22 — recuperação V12.4 e base vetorial

- Preservada a fonte histórica V12.4 e suas auditorias em `legacy/v12.4-source/`.
- Recuperadas as 39 imagens de referência em `assets/reference-panels/`.
- Adicionada fixture PSD histórica e teste de leitura pelo parser V2.
- Criado motor inicial de caminhos Bézier e exportação SVG em `src/tools/paths.js`; interface Pen Tool ainda pendente.
- Consulte `MIGRACAO_V12_4_V22.md` para distinguir testes históricos V1 de validações reais V2.


### V23 — Caneta vetorial inicial
- Adicionada ferramenta Caneta (P) com criação de nós por clique e alças Bézier por arraste.
- Clique próximo ao primeiro nó fecha o caminho; Enter finaliza um caminho aberto; Esc descarta o caminho em edição.
- Caminhos são desenhados como overlay não destrutivo e podem ser exportados em SVG por Arquivo > Exportar caminhos SVG.
- Limitação: caminhos ainda são temporários da sessão e não são serializados no MCUT nem exportados como paths PSD editáveis.
