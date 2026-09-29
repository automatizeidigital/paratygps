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

Abra `index.html` por um servidor HTTPS para permitir geolocalização e instalação como PWA. Para usar o mapa sem sinal, percorra antes, com internet, a área e os níveis de zoom que vai usar; áreas nunca vistas continuam exigindo conexão. Os dados náuticos colaborativos não substituem cartas atualizadas e avisos aos navegantes da Marinha do Brasil.

Aplicativo publicado: https://paraty-gps-maritimo.pedro7535.chatgpt.site
