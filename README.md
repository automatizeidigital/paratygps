# ParatyGPS

Aplicativo PWA de GPS marítimo para a baía de Paraty (RJ).

## Recursos

- Posição, velocidade, rumo e precisão via GPS do aparelho.
- Registro de percurso e pontos salvos localmente.
- Exportação em GPX.
- Mapa OpenStreetMap com camada colaborativa OpenSeaMap.
- Instalação na tela inicial por manifesto e service worker.

Abra `index.html` por um servidor HTTPS para permitir geolocalização e instalação como PWA. O mapa colaborativo requer internet; as folhas da carta 1633 podem ser baixadas para uso offline conforme instruções abaixo. Os dados náuticos colaborativos não substituem cartas atualizadas e avisos aos navegantes da Marinha do Brasil.

Aplicativo publicado: https://paratygps.vercel.app

## Carta 1633 e uso offline

As duas folhas do arquivo `1633_0.zip` fornecido pelo usuário estão disponíveis no seletor **Carta náutica 1633**:

- **163302 — Baía de Paraty e adjacências:** escala 1:20.000; correção informada no KAP: 04/02/2022, aviso 2022-17.
- **163301 — Baía da Ilha Grande, parte oeste:** escala 1:40.075; correção informada no KAP: 16/04/2026, aviso 2026-24.

Selecione a folha e use **Ver carta** para enquadrar sua cobertura. **Salvar cartas offline** baixa as duas folhas completas, aproximadamente 2 MB. Aguarde a confirmação antes de sair da área com internet. A tela, as cartas salvas, os pontos e os percursos podem ser reabertos offline no mesmo navegador/aparelho. O mapa colaborativo externo continua dependente de internet; fora da cobertura das folhas, não existe fundo cartográfico offline. O navegador pode remover o armazenamento local se faltar espaço.

As datas são metadados do arquivo recebido, sem confirmação de que incluem todos os avisos posteriores. A folha de Paraty tem correção mais antiga que a folha geral. A carta não valida automaticamente roteiros, profundidade disponível, maré ou calado.

### Conversão reproduzível

`python3 tools/convert_charts.py /diretorio/dos/KAP` requer rasterio, numpy e Pillow. A conversão mantém todos os pixels em WebP sem perdas, divididos em blocos de 2048 pixels carregados por área visível. O ajuste em Mercator esférico usa os 100 pontos REF de cada KAP; o maior resíduo é inferior a 0,02 pixel. O manifesto registra SHA-256 da fonte e resultado do ajuste. Isso verifica a transformação matemática, não a exatidão hidrográfica da fonte.

## Acesso e contas

O aplicativo abre `login.html` antes de carregar o mapa. A tela permite login por e-mail/senha, cadastro com confirmação de e-mail, recuperação de senha e fluxo Google com PKCE. As credenciais são validadas pelo Supabase Auth; o cliente usa somente a chave pública. A versão vendorizada do SDK é `@supabase/supabase-js@2.117.2`.

A conta administradora master solicitada tem o papel `master_admin` em `app_metadata`, definido por operação administrativa no servidor. A senha não é distribuída no código e nenhum endpoint público de criação de administradores foi instalado. `user_metadata` não determina permissões. O papel da aplicação não equivale a superusuário do banco, e as políticas existentes continuam protegendo os registros por proprietário.

Pontos, percursos, histórico e rascunhos continuam locais e passam a usar chaves com o ID de cada usuário; esta alteração não implementa sincronização na nuvem. No primeiro login online do master, os dados locais anteriores são transferidos para sua conta. Novos usuários começam com dados separados. A cópia offline das cartas é compartilhada no aparelho porque não contém dados pessoais.

Sem internet, a última conta verificada neste navegador pode abrir apenas seus dados locais e cartas já salvas. Esse modo não concede autorização para operações no servidor nem funções administrativas. Sair da conta remove o acesso offline lembrado; pontos e viagens permanecem separados por usuário para o próximo login. Em aparelhos compartilhados, os dados locais não são criptografados e podem ser inspecionados por quem controla o navegador.

### Ativar Google e links de confirmação

No projeto Supabase `zrlzgckdfpeatzkqjaih`, configure:

1. **Authentication → URL Configuration:** Site URL `https://paratygps.vercel.app`; permita o redirect `https://paratygps.vercel.app/login.html` para Google, confirmação e recuperação. Use um domínio de produção estável; evite autorizar previews indiscriminadamente.
2. **Authentication → Sign In / Providers → Google:** habilite o provedor e informe o Client ID e Client Secret criados no Google Auth Platform. O segredo fica somente no painel Supabase.
3. **Google Auth Platform → Clients:** origem JavaScript `https://paratygps.vercel.app`; redirect URI `https://zrlzgckdfpeatzkqjaih.supabase.co/auth/v1/callback`.
4. Confira o envio de e-mails para cadastro e recuperação em **Authentication → Email / SMTP Settings**. O SMTP padrão do Supabase pode restringir destinatários; configure um remetente próprio para oferecer cadastro a usuários externos.

O provedor Google estava desativado na implantação desta alteração. O botão consulta a configuração pública antes de iniciar OAuth e mostra uma mensagem clara enquanto ele estiver desativado. A integração é ativada pelo painel sem alteração de código. Não desative a validação de nonce.

### Verificação

`node tests/nautical.test.cjs` verifica cartas e armazenamento. `node tests/auth.test.cjs` verifica identificação do master, separação de dados e bloqueio de sessões inválidas. Também foram verificados em Chromium: redirecionamento de acesso anônimo, login real do master, migração local, mapa, logout, reabertura offline, layout mobile e cadastro simulado. O fluxo de consentimento Google exige a configuração acima e ainda não foi executado de ponta a ponta.
