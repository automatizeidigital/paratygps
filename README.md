# ParatyGPS

Aplicativo PWA de GPS marítimo para a baía de Paraty (RJ).

## Recursos

- Posição, velocidade, rumo e precisão via GPS do aparelho.
- Registro de percurso e pontos salvos localmente.
- Exportação em GPX.
- Mapa OpenStreetMap com camada colaborativa OpenSeaMap.
- Instalação na tela inicial por manifesto e service worker.

Abra `index.html` por um servidor HTTPS para permitir geolocalização e instalação como PWA. O mapa colaborativo requer internet. Os dados náuticos colaborativos não substituem cartas atualizadas e avisos aos navegantes da Marinha do Brasil.

Aplicativo publicado: https://paratygps.vercel.app

## Mapa e uso offline

O projeto utiliza o mapa online OpenStreetMap com balizamento colaborativo OpenSeaMap. As imagens, controles e ferramentas de conversão da carta 1633 foram removidos. A atualização do service worker elimina as cópias antigas dessas cartas, preservando pontos, percursos e dados por conta.

O fundo do mapa depende de internet. Sem conexão, os dados locais continuam disponíveis por até 24 horas após a verificação da liberação; a tela informa quando o mapa está indisponível.

## Acesso e contas

O aplicativo abre `login.html` antes de carregar o mapa. A tela permite login por e-mail/senha, cadastro com confirmação de e-mail, recuperação de senha e fluxo Google com PKCE. As credenciais são validadas pelo Supabase Auth; o cliente usa somente a chave pública. A versão vendorizada do SDK é `@supabase/supabase-js@2.117.2`.

A conta administradora master solicitada tem o papel `master_admin` em `app_metadata`, definido por operação administrativa no servidor. A senha não é distribuída no código e nenhum endpoint público de criação de administradores foi instalado. `user_metadata` não determina permissões. O papel da aplicação não equivale a superusuário do banco, e as políticas existentes continuam protegendo os registros por proprietário.

Pontos, percursos, histórico e rascunhos continuam locais e passam a usar chaves com o ID de cada usuário; esta alteração não implementa sincronização na nuvem. No primeiro login online do master, os dados locais anteriores são transferidos para sua conta. Novos usuários começam com dados separados.

Sem internet, a última conta liberada e verificada nas últimas 24 horas neste navegador pode abrir seus dados locais. Esse modo não concede autorização para operações no servidor nem funções administrativas. Sair da conta remove o acesso offline lembrado; pontos e viagens permanecem separados por usuário para o próximo login. Em aparelhos compartilhados, os dados locais não são criptografados e podem ser inspecionados por quem controla o navegador.

### Ativar Google e links de confirmação

No projeto Supabase `zrlzgckdfpeatzkqjaih`, configure:

1. **Authentication → URL Configuration:** Site URL `https://paratygps.vercel.app`; permita o redirect `https://paratygps.vercel.app/login.html` para Google, confirmação e recuperação. Use um domínio de produção estável; evite autorizar previews indiscriminadamente.
2. **Authentication → Sign In / Providers → Google:** habilite o provedor e informe o Client ID e Client Secret criados no Google Auth Platform. O segredo fica somente no painel Supabase.
3. **Google Auth Platform → Clients:** origem JavaScript `https://paratygps.vercel.app`; redirect URI `https://zrlzgckdfpeatzkqjaih.supabase.co/auth/v1/callback`.
4. Confira o envio de e-mails para cadastro e recuperação em **Authentication → Email / SMTP Settings**. O SMTP padrão do Supabase pode restringir destinatários; configure um remetente próprio para oferecer cadastro a usuários externos.

O provedor Google estava desativado na implantação desta alteração. O botão consulta a configuração pública antes de iniciar OAuth e mostra uma mensagem clara enquanto ele estiver desativado. A integração é ativada pelo painel sem alteração de código. Não desative a validação de nonce.

### Verificação

`node tests/sw.test.cjs` verifica atualização e limpeza dos caches antigos. `node tests/auth.test.cjs` verifica identificação do master, separação de dados e bloqueio de sessões inválidas. Também foram verificados em Chromium: redirecionamento de acesso anônimo, login real do master, migração local, mapa, logout, reabertura offline, layout mobile e cadastro simulado. O fluxo de consentimento Google exige a configuração acima e ainda não foi executado de ponta a ponta.

## Liberação comercial por revenda

Toda conta nova (e-mail ou Google) recebe status `pending` por trigger em `auth.users`. Confirmar o e-mail não libera a plataforma. O administrador master usa `admin.html` (link Gerenciar acessos no mapa) para liberar ou suspender clientes após a contratação com a revenda. Não há cobrança automática nesta versão.

A migração `supabase/migrations/20260930040039_manual_access_approval.sql` cria registros privados, auditoria das alterações e RPCs autenticadas. Apenas a função protegida por papel master verificado no banco pode alterar permissões. Nenhuma chave privilegiada fica no navegador. Políticas restritivas exigem aprovação atual nas quatro tabelas de negócio, além da propriedade existente. A conta master é protegida contra suspensão.

O aplicativo verifica a liberação antes de carregar o mapa, ao recuperar conexão/foco e a cada minuto. Conta pendente/suspensa abre `access.html`. O acesso aos dados locais offline exige aprovação consultada nas últimas 24 horas; registros offline antigos sem aprovação são invalidados. A suspensão no banco é imediata; um aparelho desconectado só percebe a suspensão ao conectar ou esgotar esse prazo. Como toda aplicação estática, o cache e os arquivos locais não são um mecanismo DRM contra manipulação do navegador; o banco aplica autorização independentemente do cliente.

`tests/access-rls.sql` verifica as permissões reais do banco em uma transação revertida: pendência inicial, cadastro Google, metadados forjados, autoliberação bloqueada, aprovação, suspensão, RLS, proteção do master e auditoria.

## Mapa em tela cheia

“Abrir mapa em tela cheia” no painel e “Tela cheia” no mapa expandem o mapa para toda a área do aplicativo, sem depender da Fullscreen API. O mesmo elemento Leaflet é movido para fora do painel e mantém GPS, percurso, pontos e roteiro. Há comandos de marcar ponto e iniciar/parar percurso. “Voltar aos ajustes”, Escape e Voltar restauram a posição do mapa e do painel. As barras do navegador continuam sob controle do aparelho.

Os scripts do mapa usam URLs com versão e são atualizados pela rede, com cache como alternativa offline, para evitar mistura entre uma página nova e scripts antigos.

## Auditoria e regressões

Consulte `AUDIT.md` para as correções, evidências, limites e pendências de 30/09/2026. O GPS exige posição recente para iniciar gravação e permanece no mesmo mapa ao recuperar conexão. Falhas de armazenamento são informadas e dados em memória podem ser exportados. Sessões encerradas são verificadas no banco; cabeçalhos de proteção são definidos em `vercel.json`.
