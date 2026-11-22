# MangaCut Studio 2.0 — V19

## Cinco blocos desta rodada

1. **Leitura PSB de canais com comprimentos de 64 bits:** o parser agora lê o campo de tamanho completo do canal PSB em vez de exigir que os quatro bytes superiores sejam zero. Valores fora da faixa segura de JavaScript continuam sendo rejeitados antes de qualquer alocação.
2. **Estimativa de memória do histórico em hierarquias:** snapshots agora percorrem rasters dentro de grupos aninhados; antes, somente camadas de primeiro nível eram contabilizadas.
3. **Validação de estrutura do histórico:** IDs ausentes/duplicados, hierarquias órfãs ou cíclicas não podem gerar uma estimativa artificialmente baixa; o checkpoint é recusado com aviso em vez de subestimar memória.
4. **Máscaras de grupo PSD:** o parser detecta explicitamente esse recurso ainda não suportado e usa a imagem composta como fallback, evitando importar camadas com aparência incorreta.
5. **Clipping PSD:** testes de regressão garantem que camadas com clipping não sejam silenciosamente tratadas como raster comum; o fallback composto preserva a aparência visual.

## Validação

- `npm test`: 57/57 testes aprovados.
- `npm run check`: 19/19 módulos JavaScript verificados.
- Cobertura adicional para hierarquia órfã no histórico, máscara de grupo e clipping PSD.

## Limitações

- Máscaras de grupo e clipping ainda não são editáveis/importados como estrutura nativa; nesses casos, o MangaCut usa o composto para preservar o visual.
- O suporte a comprimentos de 64 bits remove a restrição estrutural do parser, mas arquivos que exijam mais memória que o orçamento de importação continuam bloqueados com segurança.
- Não foi realizado teste de abertura e salvamento em Adobe Photoshop nesta rodada.
