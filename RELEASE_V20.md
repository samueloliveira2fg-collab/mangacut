# MangaCut Studio 2.0 — V20

## Cinco blocos concluídos

1. **Detecção de perfil ICC:** o leitor de recursos de imagem PSD/PSB identifica o recurso ICC incorporado (0x040F) e informa que ele existe, sem fingir que converteu as cores.
2. **Preservação da informação de perfil:** a identificação ICC detectada é anexada ao documento importado e pode ser mantida pelos metadados de projeto já suportados pelo formato MCUT.
3. **Validação de recursos PSD:** blocos de recursos com assinatura, cabeçalho ou comprimento inválidos são reportados com segurança, sem tentar ler além dos limites do bloco.
4. **Máscaras de grupo:** o comportamento de fallback composto para máscaras aplicadas a grupos foi mantido e coberto por teste de regressão, evitando uma árvore editável que alteraria a aparência.
5. **Clipping e flags avançadas de máscara:** clipping continua usando fallback composto com diagnóstico específico; flags reservadas/desconhecidas de máscaras também são identificadas e encaminhadas ao fallback seguro.

## Validação

- `npm test`: 60/60 testes aprovados.
- `npm run check`: 19/19 módulos JavaScript verificados.
- Novos testes para ICC válido, recurso ICC truncado/inválido e flags avançadas de máscara.

## Limitações

- A presença do ICC é detectada, mas os dados binários do perfil não são incorporados ao documento MCUT e não há conversão ICC de pixels.
- Máscaras de grupo e clipping ainda não são editáveis como estruturas nativas; o fallback achatado é intencional para evitar mudança visual.
- Não foi executado teste de abertura no Photoshop nesta rodada.
