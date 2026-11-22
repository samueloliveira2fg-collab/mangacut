# MangaCut Studio 2.0 — V23

## Entregas
- Ferramenta Caneta vetorial na barra lateral (atalho P).
- Nós criados por clique e alças Bézier criadas por arraste.
- Fechamento ao clicar próximo ao primeiro nó; Enter finaliza caminho aberto; Esc descarta o caminho em edição.
- Overlay de caminhos sem alterar pixels da camada.
- Exportação de caminhos para SVG via Arquivo > Exportar caminhos SVG.

## Validação
- `npm run check`: PASS (20 módulos JavaScript).
- `npm test`: PASS (66/66 testes).
- Inicialização HTTP local: servidor respondeu; tentativa de Chromium headless expirou após 25 s, então interação visual automatizada: NOT RUN.
- Compatibilidade do SVG em aplicativos externos: NOT RUN.

## Limitações conhecidas
- Caminhos vetoriais ainda são temporários da sessão; não são gravados no MCUT/PSD.
- Ainda não há seleção/edição de nós existentes com mouse, conversão path->selection/mask, Pen Tool de subtração, ou máscaras vetoriais.
- Recursos PSD/PSB avançados continuam com as limitações descritas no README.
