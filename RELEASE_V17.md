# MangaCut Studio 2.0 — V17

## Cinco blocos concluídos nesta rodada

1. **Estimativa de memória por hierarquia:** a varredura agora percorre grupos aninhados sem criar filtros repetidos em cada nível, contabilizando rasterizações e máscaras.
2. **Validação estrutural das camadas:** IDs duplicados, referências de pais inexistentes e hierarquias cíclicas/incompletas invalidam a estimativa e interrompem exportações que dependem dela, em vez de subestimar memória.
3. **Grupos PSD malformados:** marcadores de abertura/fechamento inconsistentes agora acionam fallback para o composto, evitando apresentar uma árvore de camadas potencialmente incorreta.
4. **Máscaras PSD mais seguras:** geometrias ativas com dimensões zero, aritmética insegura ou área acima do limite são rejeitadas com fallback composto; máscaras desativadas não são decodificadas desnecessariamente.
5. **Regressão e documentação:** testes para hierarquias inválidas, grupos sem fechamento, máscaras inválidas e estimativa em grupos profundos; atualização de versão e relatório.

## Validação

- `npm test`: 51/51 testes aprovados.
- `npm run check`: 19/19 módulos JavaScript verificados.
- Testes cobrem grupos aninhados, IDs duplicados, pais inexistentes, ciclos, grupo PSD sem fechamento e máscara ativa de largura zero.

## Limitações

- PSB ainda é exportado achatado; esta rodada não implementa gravação PSB em camadas/grupos.
- O parser ainda não reproduz máscaras de grupo, CMYK/Lab, 16/32 bits, Smart Objects, estilos avançados ou todos os recursos de clipping.
- Não foi concluído teste interativo completo em Chromium nesta rodada.
