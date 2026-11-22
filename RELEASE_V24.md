# MangaCut Studio 2.0 — V24

## Recorte para seleção

- O menu **Imagem → Recortar para seleção** reduz o documento aos limites visíveis da seleção.
- Mantém o alinhamento das camadas raster, máscaras, textos e canais alfa.
- O recorte usa os limites retangulares da seleção; pixels dentro desse retângulo permanecem intactos.
- Por segurança, a ação não prossegue enquanto houver camada raster ou texto com escala ou rotação diferente do padrão.
- O recorte é registrado no histórico e pode ser desfeito.

## Verificação

- 69 testes automatizados aprovados.
- 21 módulos JavaScript passaram na checagem de sintaxe.
