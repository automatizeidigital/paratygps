# ParatyGPS

Aplicativo PWA de GPS marítimo para a baía de Paraty (RJ).

## Recursos

- Posição, velocidade, rumo e precisão via GPS do aparelho.
- Registro de percurso e pontos salvos localmente.
- Exportação em GPX.
- Mapa OpenStreetMap com camada colaborativa OpenSeaMap.
- Instalação na tela inicial por manifesto e service worker.

Abra `index.html` por um servidor HTTPS para permitir geolocalização e instalação como PWA. O mapa colaborativo requer internet; as folhas da carta 1633 podem ser baixadas para uso offline conforme instruções abaixo. Os dados náuticos colaborativos não substituem cartas atualizadas e avisos aos navegantes da Marinha do Brasil.

Aplicativo publicado: https://paraty-gps-maritimo.pedro7535.chatgpt.site

## Carta 1633 e uso offline

As duas folhas do arquivo `1633_0.zip` fornecido pelo usuário estão disponíveis no seletor **Carta náutica 1633**:

- **163302 — Baía de Paraty e adjacências:** escala 1:20.000; correção informada no KAP: 04/02/2022, aviso 2022-17.
- **163301 — Baía da Ilha Grande, parte oeste:** escala 1:40.075; correção informada no KAP: 16/04/2026, aviso 2026-24.

Selecione a folha e use **Ver carta** para enquadrar sua cobertura. **Salvar cartas offline** baixa as duas folhas completas, aproximadamente 2 MB. Aguarde a confirmação antes de sair da área com internet. A tela, as cartas salvas, os pontos e os percursos podem ser reabertos offline no mesmo navegador/aparelho. O mapa colaborativo externo continua dependente de internet; fora da cobertura das folhas, não existe fundo cartográfico offline. O navegador pode remover o armazenamento local se faltar espaço.

As datas são metadados do arquivo recebido, sem confirmação de que incluem todos os avisos posteriores. A folha de Paraty tem correção mais antiga que a folha geral. A carta não valida automaticamente roteiros, profundidade disponível, maré ou calado.

### Conversão reproduzível

`python3 tools/convert_charts.py /diretorio/dos/KAP` requer rasterio, numpy e Pillow. A conversão mantém todos os pixels em WebP sem perdas, divididos em blocos de 2048 pixels carregados por área visível. O ajuste em Mercator esférico usa os 100 pontos REF de cada KAP; o maior resíduo é inferior a 0,02 pixel. O manifesto registra SHA-256 da fonte e resultado do ajuste. Isso verifica a transformação matemática, não a exatidão hidrográfica da fonte.
