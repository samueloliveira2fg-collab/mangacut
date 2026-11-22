# Auditoria técnica — MangaCut Studio V12.1

**Data:** 16/11/2026  
**Base:** arquivo `MangaCut_Studio_V12_AnimeSeg_IA.rar` enviado pelo usuário.  
**Escopo:** correções de hierarquia PSD/camadas e remoção de achatamento silencioso. A etapa de treinamento da Anime Segmentation foi deixada para uma próxima mensagem.

## Alterações aplicadas

1. Leitor PSD: documento com mais de 40 camadas ou alto custo estimado deixa de ser achatado automaticamente. O custo passa a gerar aviso de RAM.
2. Validação de registros: retirado o limite fixo de 1.500 camadas. O parser verifica se o número informado cabe no tamanho da seção de camadas, mantendo a validação estrutural.
3. Editor: removidos os limites artificiais de 40 camadas para criar, duplicar, inserir imagem/PSD, inserir a saída da IA e abrir projeto `.mcut`.
4. Inserção PSD: o fluxo de inserir PSD em um documento aberto deixou de solicitar `flattenOnly`; cada camada é importada separadamente, com máscaras raster e IDs de grupo remapeados para evitar colisões.
5. Escritor PSD: removido limite fixo de 120 camadas. A verificação considera o limite de 32.768 registros do PSD v1, incluindo marcadores de grupo.
6. Exportação PSD: removido o fallback que transformava documentos grandes em um PSD de composição achatada. A exportação tenta preservar todas as camadas; se falhar por memória ou por formato, informa o erro e mantém o documento aberto.
7. RAM/histórico: o aviso de desempenho informa a quantidade de etapas de desfazer usada em documentos grandes. A prévia pode ser reduzida, mas não altera os pixels que alimentam a exportação.
8. Interface: o botão de inserção identifica Imagem/PSD, e a versão foi atualizada para V12.1.

## Testes executados

| Teste | Resultado |
|---|---|
| Sintaxe JavaScript dos 5 blocos inline | Passou |
| `py_compile` nos scripts de serviço e treinamento | Passou |
| Testes automatizados do serviço local de IA (sessão simulada) | 2 passaram |
| Abrir PSD de exemplo `PSD_V10_roundtrip.psd` | Passou: 735 × 630, 5 camadas |
| Gerar/exportar/reabrir PSD de regressão com 1.501 camadas | Passou |
| Preservar dois níveis de pastas e associação das camadas ao subgrupo | Passou |
| PSD com mais de 40 camadas não virar composição automática | Passou no teste de regressão |
| Verificação de limites 40 / 120 / 1.500 no código | Limites artificiais removidos |
| Teste visual/interativo completo no Chromium headless | Não concluído: o navegador travou na etapa de inicialização do ambiente de teste |

O teste de 1.501 camadas é uma fixture sintética criada para testar o leitor/escritor. Não é um dos PSDs reais do usuário.

## Não testado / não pode ser considerado concluído

- PSDs reais do usuário com grupos aninhados, máscaras e camadas que estavam sendo achatados.
- Validação de todos os tipos de marcador `lsct`, máscaras vetoriais, clipping masks, canais especiais, blending avançado e camadas de ajuste.
- Abrir/exportar RGB16, PSB, CMYK ou Grayscale.
- Teste de exportação PSD de centenas de camadas em documentos reais de alta resolução sob limite real de RAM do computador do usuário.
- Inferência usando o peso ONNX real neste ambiente; o teste automatizado usa uma sessão ISNet simulada.
- Treinamento/fine-tuning: não foi iniciado nesta revisão e não há pesos customizados.
- Medição de precisão/recall ou IoU em conjuntos de validação de mangá/HQ.
- A janela/aba exclusiva da IA com controles próprios de pincel, restaurar e apagar; atualmente a IA ainda está numa seção expansível lateral.

## Limitações conhecidas e tratamento

- **RAM do navegador:** não há como prometer edição de qualquer tamanho sem limites físicos. A V12.1 não descarta camadas para caber no orçamento: avisa e pode interromper a ação.
- **Exportação PSD:** o escritor mantém as camadas, mas cria estruturas/canais comprimidos em memória. Em documentos extremos, pode falhar por RAM; nesse caso, não exporta uma composição achatada por conta própria.
- **PSD v1:** máximo de 30.000 px por lado. PSB ainda não foi implementado.
- **Profundidade/cor:** somente RGB 8 bpc é suportado pelo fluxo de camadas atual. O projeto V11.3 RGB16 não deve ser tratado como uma versão final integrada.
- **Histórico:** 12 etapas normalmente; 4 acima de 9 MP; 2 acima de 25 MP. A mensagem de RAM agora informa esse ajuste. Não afeta resolução nem pixels exportados.
- **IA:** serviço local SkyTNT ISNet/ONNX. A inferência trabalha com prévia de até 1024 px no lado maior e amplia a máscara resultante. Esse processo não garante recuperar contornos menores que a resolução de entrada.
- **Treino:** scripts estão presentes, mas o modelo não foi treinado com PSDs, HQs ou PNGs do armazenamento do usuário. A etapa foi expressamente reservada para outra mensagem. Os 39 painéis de referência não são exemplos supervisionados sem máscaras revisadas.
- **UI IA:** integração atual é painel expansível, não a aba exclusiva solicitada. A interface dedicada permanece pendente.

## Próximas prioridades

1. Receber e testar pelo menos um PSD real que estava chegando achatado, de preferência com grupos aninhados.
2. Comparar camadas, nomes, hierarquia, máscaras e composição antes/depois da exportação editada.
3. Criar a aba exclusiva da IA e os controles manuais de retoque pós-inferência.
4. Tratar treinamento em mensagem separada, com amostras rotuladas e validação em conjunto separado.
5. Planejar RGB16/PSB e uma arquitetura de processamento por tiles sem reduzir pixels originais.

