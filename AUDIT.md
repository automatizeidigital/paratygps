# Auditoria do ParatyGPS — 30/09/2026

Escopo: código publicado, autenticação Supabase, autorização de revenda, políticas do banco, scripts vendorizados, mapa/GPS, pontos, percursos, histórico, GPX, tela cheia, cache PWA e cabeçalhos HTTP. As correções acompanham este relatório no repositório. Esta revisão e os testes descritos não garantem ausência de todas as vulnerabilidades nem substituem um teste de intrusão independente.

## Falhas corrigidas e reforços aplicados

| Área | Problema constatado | Correção |
|---|---|---|
| Dados locais | Pontos nulos, coordenadas inválidas e datas fora do intervalo podem quebrar o mapa ou exportação. | Validação antes de criar camadas; datas normalizadas; nomes tratados como texto. |
| Armazenamento | Falha de gravação de pontos/roteiro pode interromper a ação; histórico pode anunciar sucesso após uma falha. | Tratamento de erro, aviso explícito e exportação dos dados ainda em memória. |
| GPS | É possível iniciar percurso com posição anterior mesmo depois de desligar o GPS. | Gravação exige GPS ativo e posição recente; ponto inicial é incluído. |
| Percurso | Apagar um percurso durante a gravação pode invalidar o índice usado para salvar a viagem. | Bloqueio da limpeza enquanto há gravação. |
| GPS e reconexão | A consulta de autorização recarrega a página quando a conexão retorna, interrompendo o GPS. | Atualização da conta no mesmo mapa após confirmar a identidade e aprovação. |
| Histórico | Nome da viagem depende de janela nativa, inadequada ao modo de mapa ampliado. | Formulário interno compartilhado com a marcação de pontos. |
| Sessão no cliente | Erros sem status HTTP são tratados genericamente como falha de internet. | Alternativa offline somente para erros de transporte; sessão/permissão inválida bloqueia o acesso. |
| Sessão no servidor | Um JWT ainda dentro de sua validade pode continuar autorizando operações após sair da conta. | Verificação do `session_id` em `auth.sessions`, incluindo a validade `not_after`. |
| Administração | Sair pode disparar duas navegações concorrentes; dados da lista podem permanecer em outra aba. | Redirecionamento único e limpeza da lista na troca/saída de conta; nova consulta ao voltar de cache de navegação. |
| Navegação | Retorno por cache do navegador pode reapresentar um mapa autorizado anteriormente. | Nova inicialização de autorização antes de expor o mapa restaurado. |
| Formulário | A opção Mostrar senha permanece ativa ao trocar o modo do formulário. | Retorno automático ao campo de senha oculto. |
| HTTP | Não havia política explícita para scripts, incorporação por outros sites, MIME e recursos do navegador. | CSP com scripts somente da própria origem, bloqueio de enquadramento, nosniff, política de referenciador e restrição de câmera/microfone/pagamento. Geolocalização é mantida. |
| Banco | Quatro políticas recalculam identidade por linha; cinco chaves estrangeiras não tinham índices de apoio. | Identidade por consulta, papéis explícitos, WITH CHECK explícito e cinco índices. |
| Dependências | Arquivos vendorizados não tinham lockfile de referência. | Versões e árvore de dependências registradas em vendor/package.json e vendor/package-lock.json. |

## Evidências de verificação

- Testes unitários de autorização: papel controlado no servidor, separação de armazenamento, conta pendente/suspensa, sessão inválida, expiração de 24 horas offline e distinção entre transporte e permissão.
- Transação real e revertida no Supabase: cadastro pendente, metadados falsificando master rejeitados, autoliberação e escrita direta bloqueadas, aprovação/suspensão, isolamento entre contas, transferência de proprietário bloqueada, conta master protegida, auditoria e sessão revogada bloqueada. Nenhum usuário de teste é mantido após essa transação.
- Chromium: login real do master, consulta de administração, dados locais malformados, nome contendo HTML malicioso, GPS/movimentos simulados, percurso, histórico, tela cheia/Voltar, GPX analisado como XML, falha de quota simulada, GPS pausado, offline e reconexão, logout e requisição com JWT encerrado rejeitada. Sem erros JavaScript no fluxo testado.
- O cadastro e a recuperação de senha são interceptados nos testes de interface para não enviar mensagens a destinatários reais. O envio de e-mail e o consentimento Google não são considerados validados por esse teste.
- CSP é aplicada ao servidor local de testes e à implantação Vercel. O cabeçalho de produção deve ser conferido após a publicação.
- `npm audit` da árvore Supabase 2.117.2 e Leaflet 1.9.4: zero vulnerabilidades conhecidas informadas em 30/09/2026. Isso não detecta todas as falhas possíveis dos arquivos vendorizados ou da aplicação.
- Advisors de desempenho após as correções: nenhum WARN remanescente; índices novos sem uso registrado são informativos e foram mantidos para propriedade e chaves estrangeiras.

## Pendências e limites

1. **Proteção contra senhas vazadas desativada no Supabase (WARN).** A ferramenta conectada não expõe a alteração dessa configuração. Habilitar no painel, conforme disponibilidade do plano: [orientação oficial](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
2. **Google permanece desativado.** Requer Client ID/Secret e ativação do provedor. O aplicativo informa a indisponibilidade; não foi executado consentimento OAuth real.
3. **E-mails de cadastro e recuperação:** envio a clientes externos e configuração SMTP ainda precisam de validação operacional. Nenhum teste desta revisão enviou mensagens reais.
4. **Dados de navegação ficam neste navegador/aparelho.** Não há sincronização na nuvem nem criptografia do armazenamento local. Quem controla o aparelho pode inspecionar ou alterar dados locais. Não há garantia contra cópia/modificação do código estático ou alteração do prazo offline no próprio navegador; autorização do banco é independente do cliente.
5. **Offline de até 24 horas:** a suspensão de um aparelho desconectado só é percebida ao reconectar ou vencer o prazo. O fundo do mapa depende de internet. A carta náutica removida não foi reinstalada.
6. **Tabelas privadas sem políticas:** os dois avisos INFO de RLS sem política são intencionais: acesso direto negado por RLS e grants revogados, com operações autorizadas através das funções privadas protegidas. [Explicação do advisor](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
7. GPS foi simulado em navegador; comportamento do receptor, sinal, permissões e suspensão em segundo plano precisam de teste no aparelho real. O sistema não calcula passagem segura nem substitui instrumentos e cartas atualizados.

## Reprodução

Na raiz do projeto:

```
node tests/auth.test.cjs
node tests/sw.test.cjs
```

`tests/access-rls.sql` é executado no projeto vinculado como postgres e reverte seus dados de teste. `tests/browser.audit.cjs` requer Playwright disponível, um servidor local e as variáveis PARATY_TEST_PASSWORD e, opcionalmente, PARATY_TEST_EMAIL/PARATY_TEST_URL. Não grave credenciais no repositório. Variáveis de Chromium/proxy são opcionais para ambientes de automação; não fazem parte da configuração de produção.

Integridade dos arquivos examinados (SHA-256):

- SDK Supabase: `59d39487c3589843b410322d8a3d562ce022aba1e5ccb16898ef3fb2a0da2ecd`
- Leaflet: `db49d009c841f5ca34a888c96511ae936fd9f5533e90d8b2c4d57596f4e5641a`
