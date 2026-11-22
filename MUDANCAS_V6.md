# MangaCut Studio 2.0 — V6

## Implementado nesta versão

- Camadas de texto editáveis no formato MCUT: conteúdo, família, peso, tamanho e cor são dados da camada, não pixels rasterizados.
- Edição do conteúdo de uma camada de texto existente pelo painel Propriedades.
- Mover camadas de texto com a ferramenta Mover.
- Transformação raster/texto por propriedades: posição X/Y, escala X/Y, rotação e espelhamento horizontal/vertical.
- Persistência de transformações e texto no projeto MCUT v3.
- Autosave com atraso de 1,8 s em IndexedDB e recuperação solicitada ao iniciar novamente o editor.
- Novos testes para persistência de texto e transformações.

## Limitações que continuam

- Texto editável ainda é básico: sem controles completos de fonte, kerning, tracking, parágrafo, texto em caminho, estilos de caractere ou incorporação de fontes.
- Texto e transformações são preservados no MCUT. PSD/PSB continua sendo exportado achatado; nenhum dado de camada editável é gravado no PSD.
- Transformações são aplicadas no renderizador por camada; ainda não existe caixa interativa com alças, rotação por mouse, transformação livre por seleção ou transformação de grupos.
- Autosave depende do IndexedDB e do espaço livre do navegador; não substitui salvar uma cópia MCUT em local seguro.
- Tiles continuam sendo apenas uma fundação; compositor continua Canvas 2D full-frame.
- Healing, caneta/vetores, exportação PSD em camadas, Smart Objects, worker/WASM/WebGPU, ICC/CMYK/16-bit e IA continuam pendentes.

## Verificações

- `npm test`: testes automatizados da suíte.
- `npm run check`: verificação sintática de todos os módulos JavaScript.
- Teste manual em Chrome/Edge ainda necessário para confirmar IndexedDB, renderização de texto e transformações com arquivos grandes.
