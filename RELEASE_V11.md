# MangaCut Studio 2.0 — V11

## Recuperação técnica da V12.4

- Coordenadas inversas de camadas raster transformadas, alinhadas à ordem matemática do compositor.
- Pincel, borracha, carimbo de clonagem e Healing passam a converter coordenadas do documento para o espaço local da camada.
- Testes automatizados de ida e volta para translação, escala uniforme/não uniforme, rotação e espelhamento.
- Validação explícita contra escala nula/inválida.

## Verificação desta build

- `npm test`: 30/30 aprovados.
- `npm run check`: 19 módulos JavaScript aprovados.
- Teste de navegador interativo: não executado nesta build.

## Próximos blocos obrigatórios ainda não concluídos

1. Converter seleções/máscaras de seleção entre espaço do documento e espaço local após transformações.
2. Migrar armazenamento de camadas para bounds locais e cache persistente por tiles, mantendo exportação na resolução original.
3. Restaurar exportação PSD Grayscale nativa e ampliar round-trip com fixtures reais.
4. Completar compatibilidade PSD/PSB: máscaras de grupo, canais extras, clipping, ICC, efeitos, PSB em camadas.
5. Integrar a IA local da V12.4 com controles de revisão e validação, sem treinar até haver máscaras rotuladas.
6. Completar ferramentas, workspaces e validação interativa Chrome/Edge.

A V11 preserva a base modular V10 e não incorpora PhotoCraft.
