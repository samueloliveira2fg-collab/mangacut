# Pesquisa de código aberto e licenças — MangaCut Studio

Data de verificação: 16/11/2026. Esta pesquisa compara candidatos, não significa que todos foram incorporados.

## 1. SkyTNT Anime Segmentation / ISNet — adotado

- Código: https://github.com/SkyTNT/anime-segmentation
- Modelo: https://huggingface.co/skytnt/anime-seg
- Licença indicada: Apache-2.0.
- Modelos listados no repositório: ISNet, U2Net, MODNet e InSPyReNet. O README oferece comandos de treino, inferência e exportação ONNX, com 1024 px recomendado para ISNet.
- O serviço do MangaCut usa o arquivo `isnetis.onnx` e verifica SHA-256 antes de aceitar o artefato.
- Adaptação: serviço local 127.0.0.1, ONNX Runtime, preview até 1024 px no lado maior, máscara suave ampliada para o documento e camada independente no editor.
- Limite: foi treinado para personagens de anime. Não se deve presumir precisão perfeita para retículas, balões, cenários de HQ, mangá P&B ou personagens cortados nas bordas.

## 2. ag-psd — candidato para PSD no navegador

- Projeto: https://github.com/Agamnentzar/ag-psd / https://www.npmjs.com/package/ag-psd
- Licença: MIT.
- Utilidade: ler e escrever PSD em JavaScript/TypeScript; possível caminho para ampliar cobertura de grupos, canais e metadados.
- Limite decisivo para o objetivo RGB16: a versão pesquisada declara leitura 16/32 bpc, mas não escrita 16/32 bpc. Também converte certos modos para RGB na leitura e tem limitações em perfil ICC/CMYK. Não substituir o motor atual supondo que resolve edição/exportação 16 bpc.

## 3. psd-tools — candidato para diagnóstico e processamento Python

- Projeto: https://github.com/psd-tools/psd-tools / https://psd-tools.readthedocs.io/
- Licença: MIT.
- Utilidade: leitura/escrita de estrutura PSD/PSB em baixo nível e extração de imagem de camadas. Pode apoiar inventário de arquivos e ferramentas de teste.
- Limite: edição de texto, shapes e smart objects não é suportada; composição de ajustes e efeitos é incompleta. Não é um substituto completo do Photoshop.

## 4. libvips — candidato para documentos muito grandes

- Projeto: https://github.com/libvips/libvips / https://www.libvips.org/
- Licença: LGPL-2.1-or-later.
- Utilidade: processamento de imagens demand-driven, com baixa memória e amplo suporte a tipos numéricos e formatos. Interessante para exportação por tiras, thumbnails e pipeline nativo/servidor.
- Decisão: não foi integrado ao editor web nesta etapa. Exige comparar fidelidade dos pixels, empacotamento e obrigações da LGPL antes de distribuir um executável.

## 5. SAM 2 — possível seleção assistida futura

- Projeto: https://github.com/facebookresearch/sam2
- Licença: Apache-2.0 para código, pesos e treino.
- Utilidade: segmentação promptável por interação, potencial para seleção por clique/caixa.
- Limite: mais pesado e generalista; não é especializado em personagens de anime. Deve ser avaliado como complemento sob demanda, não como substituto imediato do ISNet.

## Decisão

Integrar apenas o SkyTNT ISNet como primeira IA. Manter o parser PSD original até um conjunto de fixtures permitir comparar importação, grupos, canais, máscaras, cor e exportação. Para RGB16, nenhuma das opções pesquisadas aqui autoriza prometer suporte completo sem desenvolvimento específico e testes de round-trip.


## Atualização — 17/11/2026

- O `ag-psd` npm 34.2.0 atualmente documenta escrita em Grayscale e RGB, mas não escrita 16/32 bpc; leitura 16/32 bpc é suportada. É candidato a comparação e não substituição automática.
- `psd-tools` atual documenta leitura/escrita da estrutura PSD/PSB em baixo nível, com composição e edição avançada limitadas.
- `psd-tools2` documenta leitura de Grayscale/RGB/CMYK 8/16/32-bit e PSB, mas não escrita.
- `psd-reader` oferece leitura assíncrona segmentada e canais nativos, mas não pretende interpretar camadas individuais.
- `OpenPSD` oferece parsing PSD/PSB, grupos e decodificação lazy de camadas; ainda não é um writer completo.
- Os pacotes externos não foram executados nesta rodada; houve tentativa de obter `ag-psd` que excedeu o tempo. Nenhum código externo foi incorporado sem teste.
- A V12.3 implementa writer Grayscale nativo no código próprio e confirma round-trip em `Doriutaaaa.psd` e em fixture sintético.
