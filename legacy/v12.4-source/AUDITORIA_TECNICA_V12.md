> DOCUMENTO HISTÓRICO: auditoria da V12 original, anterior às correções V12.1. Para resultados atuais, consulte `AUDITORIA_TECNICA_V12_1.md`.

# Auditoria técnica — MangaCut Studio V12 IA

**Data:** 16/11/2026  
**Base examinada:** MangaCut Studio V11 UI Fix, V10 e arquivos anteriores recuperados.  
**Objetivo:** reduzir excesso visual, manter os recursos do editor, introduzir Anime Segmentation local e abrir um caminho verificável para ajuste fino com painéis de mangá/HQ coloridos e P&B.

## O que foi alterado nesta build

1. **Interface:** organização em três espaços de trabalho (MangaCut, Photopea/Photoshop e Masks/Fundo/Camadas), propriedades e ferramentas agrupadas em seções expansíveis, controles avançados menos expostos e presets de layout. Os presets são visuais; não mudam o motor de edição.
2. **IA Anime Segmentation:** integração com SkyTNT ISNet por serviço FastAPI local + ONNX Runtime. A inferência recebe uma prévia até 1024 px no lado maior e devolve uma máscara em PNG. A máscara é ampliada e aplicada como uma camada separada. As camadas anteriores não são apagadas.
3. **Treino supervisionado:** criação de pares imagem/máscara/manifesto depois que o usuário confirma manualmente a máscara. Há validação de dimensões, manifesto, estilo e proporção da máscara antes do conjunto de treino ser montado.
4. **PSD:** foi corrigido o fluxo de restaurar um PSD importado para reabrir o documento original, em vez de achatar/recriar camadas. A cópia de PSD sem edição continua byte por byte. Foram feitos testes de ida e volta de uma camada duplicada e de um grupo.
5. **Controles da IA:** atualização do estado dos botões depois de carregar um documento; estado do serviço distingue runtime ausente de modelo ainda não baixado. Cabeçalhos CORS e nomes de modelo são ASCII para evitar falhas de codificação em clientes HTTP.
6. **Scripts Windows:** instalação separada de runtime de inferência e dependências de treino; os launchers de preparar dados e fine-tuning aceitam Python 3.10 ou 3.11.

## Testes executados

| Área | Teste | Resultado |
|---|---|---|
| Interface desktop | Chromium 1440×900; abrir demo, layout, comparação, exportação de amostra | Passou; sem erros JavaScript |
| Interface mobile | Chromium 390×844; largura de página e fluxo básico | Passou; sem overflow horizontal e sem erros JavaScript |
| Seções | 7 acordeões de interface + painéis expansíveis | Renderizam; os painéis de IA iniciam fechados |
| Coleta de treino | Gerar PNG de entrada, máscara e manifesto | Passou em teste de UI |
| Dataset | Preparador com 6 pares rotulados fictícios de teste | Passou; teste é apenas do pipeline de dados, não treinamento da rede |
| Serviço IA | FastAPI com sessão ISNet simulada; pré-processamento, resposta PNG e CORS | Passou |
| Integração UI/IA | API simulada devolve máscara, nova camada aparece, undo/redo | Passou; nenhuma exceção JS |
| PSD sem edição | Importar PSD RGB 8-bit e exportar cópia original | Passou; bytes idênticos |
| Reset PSD | Restaurar documento importado | Passou; 5 camadas e nomes preservados |
| PSD editado | Duplicar camada, exportar e reimportar | Passou; 6 camadas reimportadas |
| Pastas PSD | Criar grupo, exportar e reimportar | Passou; grupo preservado (5 camadas + 1 pasta) |
| Python | `py_compile` nos scripts de serviço e treino | Passou |

### O que os testes ainda não demonstram

- Não foi possível executar a inferência com pesos ONNX reais nesta máquina de build; os testes de IA usam uma sessão simulada. O launcher baixa o modelo real quando executado no Windows do usuário.
- Não foi executado fine-tuning real, pois não há conjunto de máscaras revisadas suficiente nem stack PyTorch configurada no ambiente de build.
- Não há análise visual quantitativa de IoU/precision/recall sobre um holdout de HQ/mangá colorido e P&B. A qualidade deve ser avaliada com amostras que não entraram no treino.
- O teste de grupos valida um grupo simples, não pastas aninhadas complexas nem todos os marcadores/flags possíveis do PSD.
- O PSD de teste foi RGB 8 bpc; não é evidência para 16 bpc, PSB, CMYK, Grayscale, canais alpha independentes ou todos os casos de máscaras.

## Achados e severidade

### Resolvido e testado nesta build

- **Reset de PSD:** volta a importar o objeto PSD original e mantém camadas/pastas no teste de cinco camadas.
- **Cópia original:** exportação sem edição foi comparada byte por byte e passou.
- **Grupo simples:** pasta sobreviveu à exportação e reimportação editadas.
- **Estado de IA após abrir imagem:** o botão de inferência passa a acompanhar o estado do serviço e a existência de camadas.
- **Retorno IA/undo:** camada independente é removida e restaurada corretamente por desfazer/refazer no teste simulado.
- **Ambiente de build:** os scripts Python foram compilados; testes simulados do serviço e do navegador não geraram erros.

### Aberto / não resolvido

- **Alta — profundidade de cor:** o parser PSD do editor ainda rejeita profundidade diferente de 8 bits por canal e modo diferente de RGB. RGB16 não está pronto.
- **Alta — fidelidade PSD avançada:** objetos inteligentes, textos, ajustes, filtros, estilos e alguns canais/máscaras podem ser ignorados, rasterizados ou alterados na exportação editada.
- **Alta — documentos grandes:** o navegador continua limitado por RAM. Há caminhos que achatam PSD editado grande; não existe promessa de edição PSD em resolução ilimitada.
- **Alta — qualidade da IA em P&B/HQ:** o modelo original é de segmentação de personagens de anime; não há pesos especializados treinados no acervo do usuário. Contornos P&B, retículas, balões e cenas cheias exigem validação/fine-tuning.
- **Média — menu Filtro:** ainda há ações reservadas/não implementadas.
- **Média — seleção sem IA:** Varinha, Seleção Rápida e Seleção de Objeto existentes continuam heurísticas de pixel/borda; não são o mesmo motor ISNet.
- **Média — amostras de treino:** o browser exporta três arquivos separados; o usuário precisa baixá-los e mantê-los juntos em `ai_training/samples`. O PSD sozinho não contém rótulos automáticos.
- **Média — máscara de treino:** o loader upstream converte a máscara em binária por limiar 0,3 e remove 10 px das bordas. A saída de inferência continua suave, mas as bordas cinzas não são aprendidas como alpha contínuo pelo loader upstream.
- **Média — split/avaliação:** o roteiro usa divisão treino/validação, mas a avaliação confiável precisa separar painéis/fontes/personagens em um holdout sem imagens quase duplicadas.

## IA e dados de treino

O ISNet pré-treinado é a base de inferência imediata. O mesmo peso-base é usado para P&B e colorido; o seletor de estilo é metadado até que pesos customizados por estilo sejam treinados. Depois do fine-tuning, o serviço procura modelos locais separados (`mangacut_isnet_v12_bw.onnx`, `mangacut_isnet_v12_color.onnx`, `mangacut_isnet_v12_mixed.onnx`).

Não usar os 39 painéis como se já fossem dados rotulados. Um par de treino válido é: imagem original alinhada + máscara revisada (branco personagem, preto fundo). Para começar, o coletor aceita no mínimo 5 amostras para preparar o conjunto; o roteiro de treino exige 10 por seleção de estilo, mas recomendamos 50–100+ pares diversos por estilo como ponto de partida para avaliação. Mais dados limpos e variados ajudam, mas não garantem uma taxa de acerto fixa.

**Cuidado com direitos:** use conteúdo que você criou ou tem autorização para usar no treino privado; não redistribua painéis de terceiros.

## Pesquisa de código — decisões

| Projeto | Licença / utilidade | Decisão |
|---|---|---|
| SkyTNT Anime Segmentation / ISNet | Repositório Apache-2.0; treino, inferência, exportação ONNX; modelo base Apache-2.0 | Integrado como IA principal, com pesos baixados no primeiro uso |
| ag-psd | MIT; leitura/escrita PSD no ecossistema JS; não escreve PSD 16/32 bpc | Candidato para comparar/substituir partes do parser no futuro, não resolve RGB16 completo |
| psd-tools | MIT; leitura/escrita estrutural PSD/PSB e pixels de camadas; edição/composição avançada limitada | Útil para inspeção e ferramentas de diagnóstico no backend, não como engine único de edição |
| libvips | LGPL-2.1-or-later; processamento demand-driven e baixa memória; diversos formatos/tipos numéricos | Candidato para pipeline nativo/servidor de imagens grandes, após avaliação de empacotamento/licença |
| SAM 2 | Apache-2.0; segmentação promptável em imagens/vídeos | Possível complemento futuro para seleção guiada por clique, mas mais pesado e não específico para anime; não integrado nesta build |

## Próximas prioridades de engenharia

1. Testar com PSDs reais do usuário: grupos aninhados, máscaras, transparência, documentos extensos, Grayscale, RGB16, perfis e camadas especiais.
2. Para RGB16, primeiro criar fixtures de referência e comparar leitura/round-trip; não anunciar suporte até validar importação, processamento interno em 16 bits e exportação PSD 16 bpc. `ag-psd` por si só não entrega escrita 16 bpc.
3. Construir conjunto revisado separado em P&B e colorido; gerar métricas em holdout (IoU, precisão/recall de foreground e revisão visual de cabelo, contorno e áreas brancas internas).
4. Adicionar assistente de correção de máscara/contornos P&B depois de avaliar falhas do ISNet base.
5. Comparar o parser atual com `ag-psd` e `psd-tools` em fixtures idênticas antes de substituir qualquer código.
6. Considerar `libvips` para o pipeline de imagens de alta resolução e RAM; manter o original e exportar por tiras.
7. Implementar ou desabilitar claramente o menu Filtro, em vez de prometer ações que ainda não existem.

## Fontes técnicas

- SkyTNT Anime Segmentation: https://github.com/SkyTNT/anime-segmentation (modelos ISNet/U2Net/MODNet/InSPyReNet, treino, inferência e exportação ONNX).
- Loader de dados SkyTNT: https://github.com/SkyTNT/anime-segmentation/blob/main/data_loader.py (pares imagem/máscara, limiar de máscara e corte de borda).
- Modelo ISNet: https://huggingface.co/skytnt/anime-seg (artefatos e licença indicada).
- ag-psd: https://www.npmjs.com/package/ag-psd (MIT e limitações de escrita 16/32 bpc).
- psd-tools: https://github.com/psd-tools/psd-tools (MIT; suporte PSD/PSB estrutural e limites de composição/edição).
- libvips: https://github.com/libvips/libvips (LGPL-2.1-or-later, demanda e memória).
- SAM 2: https://github.com/facebookresearch/sam2 (Apache-2.0).
