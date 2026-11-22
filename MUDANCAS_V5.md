# MangaCut Studio 2.0 — V5 (recuperação e melhorias)

## Base recuperada
A V5 parte diretamente do ZIP V4 recuperado da Biblioteca do projeto. As V1–V3 também foram recuperadas para comparação. O ZIP grande `MangaCut_Studio_2.0_V2.zip` contém o pacote web PhotoCraft anterior, não o código-fonte do MangaCut 1.0 original.

## Implementado nesta V5
- Carimbo de clonagem: Alt+clique define a origem na camada raster ativa; arrastar pinta a amostra com tamanho e opacidade atuais. Respeita a seleção ativa e bloqueio da camada.
- Mais camadas de ajuste não destrutivas: sépia, limiar (threshold) e posterização, além de brilho/contraste, inverter e grayscale já existentes.
- Fundação de cache LRU limitado e divisão de documentos em tiles de 256 px (`src/render/tile-cache.js`). É infraestrutura isolada para migração futura; ainda não substitui o compositor full-frame.
- Atalho C para Carimbo de clonagem.

## Ainda não implementado (não apresentar como pronto)
- Healing real/content-aware; o clone stamp não é Healing.
- Exportação PSD/PSB com árvore de camadas, grupos, máscaras e texto.
- Smart Objects, clipping avançado, estilos PSD, CMYK/ICC e 16/32 bits.
- Texto vetorial/editável e caneta/vetores.
- Transformação livre com escala/rotação e handles.
- WebGPU/WASM e renderização por tiles efetivamente ligada ao compositor.
- Autosave de recuperação em IndexedDB e histórico por deltas.
- Seleção de objetos por IA.

## Testes
A execução dos testes e verificações desta entrega está registrada em TESTE_E_STATUS.txt. A compatibilidade PSD continua parcial, conforme as limitações herdadas da V4.
