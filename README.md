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

Abra `index.html` por um servidor HTTPS para permitir geolocalização e instalação como PWA. Para usar o mapa sem sinal, percorra antes, com internet, a área e os níveis de zoom que vai usar; áreas nunca vistas continuam exigindo conexão. Os dados náuticos colaborativos não substituem cartas atualizadas e avisos aos navegantes da Marinha do Brasil.

Aplicativo publicado: https://paraty-gps-maritimo.pedro7535.chatgpt.site
