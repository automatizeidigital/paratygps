# ParatyGPS

Aplicativo PWA de GPS marítimo para a baía de Paraty (RJ).

## Recursos

- Posição, velocidade, rumo e precisão via GPS do aparelho.
- Registro de percurso e pontos salvos localmente.
- Exportação em GPX.
- Mapa OpenStreetMap com camada colaborativa OpenSeaMap.
- Instalação na tela inicial por manifesto e service worker.
- Mapa offline: as áreas do mapa já vistas com internet ficam guardadas no aparelho (até ~4.000 blocos) e aparecem sem sinal.
- Tela mantida acesa durante a gravação do percurso, para o GPS não parar.
- Posições com precisão pior que 50 m são descartadas do percurso, e o "tremido" do GPS parado não soma distância.
- Se o app fechar durante uma gravação, ao reabrir é possível continuar ou encerrar e salvar a viagem no histórico.
- Pausar o GPS pausa também o percurso; ao religar, a gravação segue em um novo trecho (o mesmo vale para mais de 2 min sem sinal).
- Roteiro calculado: marque origem e destino e o app traça o caminho pela água sobre a carta náutica DHN nº 1633, contornando terra, ilhas, praias, lajes, áreas que secam e profundidades menores que a escolhida (2, 5 ou 10 m), com afastamento de 30 a 200 m. Pontos de passagem são opcionais e entram no trecho em que menos alongam o caminho. "Mostrar áreas a evitar" pinta no mapa o que a rota contorna.

## Carta náutica e roteamento

`chart-mask.bin` é uma máscara de 10 m (terra, seco e faixas de profundidade) gerada a partir das cartas raster da Marinha do Brasil (DHN) nº 1633 — Baía da Ilha Grande, Parte Oeste (1:40.000) e Baía de Parati e Adjacências (1:20.000). As cores da carta viram classes: ciano, azul-claro e branco correspondem a 0–5, 5–10 e mais de 10 m na carta principal e a 0–2, 2–5 e mais de 5 m no encarte. Onde as duas cartas cobrem o mesmo ponto, vale o que ambas garantem, ou o mais raso se discordarem.

Para regenerar após uma nova edição da carta (as cartas raster não ficam no repositório):

```
pip install rasterio numpy scipy
python3 tools/build_chart_mask.py <pasta com 163301.KAP e 163302.KAP> chart-mask.bin
```

`router.js` roda em um Web Worker: monta uma grade sobre a máscara, bloqueia o que é mais raso que o pedido, mantém o afastamento escolhido, prefere água mais funda e busca o menor caminho (A*). Pontos em terra ou em água rasa (cais, praia) são ligados à rota por um trecho em água rasa, mostrado tracejado e com aviso.

Limitações: levantamentos até 1979, profundidades reduzidas à baixa-mar média de sizígia; pedras isoladas desenhadas apenas como símbolo, bancos que mudaram, poitas, fazendas marinhas e avisos recentes podem não estar na máscara. A rota é uma sugestão e deve ser conferida na carta atualizada e com vigilância a bordo.

Abra `index.html` por um servidor HTTPS para permitir geolocalização e instalação como PWA. Para usar o mapa sem sinal, percorra antes, com internet, a área e os níveis de zoom que vai usar; áreas nunca vistas continuam exigindo conexão. Os dados náuticos colaborativos não substituem cartas atualizadas e avisos aos navegantes da Marinha do Brasil.

Aplicativo publicado: https://paraty-gps-maritimo.pedro7535.chatgpt.site
