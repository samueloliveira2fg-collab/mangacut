# MangaCut Studio V12.4 — Comece aqui

Esta versão corrige ferramentas que ficavam desalinhadas quando a camada estava movida, escalada, girada ou espelhada.

## O que mudou

- Pincel, borracha, restauração, varinha, conta-gotas e seleção rápida usam coordenadas locais corretas após transformações.
- Seleção de objeto, overlay de seleção e visualização da máscara acompanham as transformações.
- Cursor do pincel acompanha escala, proporção e rotação da camada.
- A transformação é calculada uma vez por quadro nos overlays, evitando trabalho repetido por pixel.

## Testes

- 5 scripts JavaScript inline: sintaxe aprovada.
- 54 PSDs reais importados: 54/54 aprovados, sem achatamento automático.
- 5 round-trips individuais aprovados (`1.psd`, `2.psd`, `6.psd`, `Gojo Combat.psd`, `Doriutaaaa.psd`).
- Fixture de 1.501 camadas + 2 grupos aninhados aprovado.
- Fixture Grayscale + alpha aprovada.
- `loki puto.psd` continua pendente por tempo de execução.
- Teste interativo completo no navegador ainda não foi possível no ambiente atual.

## O que não foi feito nesta etapa

A otimização geral de memória/armazenamento de camadas e o treinamento da IA foram deixados para a etapa final, conforme combinado. A IA existente foi preservada, mas nenhum treinamento foi executado.

Consulte `AUDITORIA_TECNICA_V12_4.md` e `PESQUISA_COMPLEMENTAR_CODIGO_17_11_2026.md` para os detalhes e as limitações.
