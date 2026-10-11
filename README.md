KEOLA BOOKS — ATALHOS DINÂMICOS DE BUSCA

O QUE MUDA
- A página mantém o layout e o catálogo catalogo.json.
- Os atalhos abaixo da busca passam a mostrar os 5 termos mais pesquisados nos últimos 30 dias.
- As pesquisas são compartilhadas entre todos os visitantes via Supabase.
- As buscas só são registradas quando a pessoa clica em Buscar, pressiona Enter ou clica em um atalho.
- Não são armazenados IP, nome, e-mail ou identificador do visitante.
- Até existirem buscas suficientes, a página mostra os atalhos iniciais de fallback.

ARQUIVOS
- index.html: versão com a área de atalhos dinâmicos.
- app.js: código do site atualizado; preserva a busca do catálogo.
- setup_supabase.sql: tabela e funções do banco de dados.

PASSO 1 — CRIAR O BACKEND COMPARTILHADO
1. Acesse https://supabase.com/ e crie um projeto.
2. Abra SQL Editor > New query.
3. Copie todo o conteúdo de setup_supabase.sql, cole no editor e execute.
4. Abra Project Settings / Connect (ou Settings > API Keys).
5. Copie a Project URL e a publishable key que começa com sb_publishable_.

PASSO 2 — CONFIGURAR app.js
No início de app.js, encontre:
const SUPABASE_URL = "COLE_AQUI_A_PROJECT_URL";
const SUPABASE_PUBLISHABLE_KEY = "COLE_AQUI_A_PUBLISHABLE_KEY";

Substitua os valores pelos dados do SEU projeto. A URL deve ser parecida com
https://xxxxxxxxxxxx.supabase.co
A chave deve começar com sb_publishable_. NÃO use sb_secret_, service_role ou qualquer chave secreta no site.

PASSO 3 — SUBSTITUIR OS ARQUIVOS NO GITHUB
No repositório keola-books-, na branch main e na pasta raiz (/):
1. Substitua index.html pelo index.html deste pacote.
2. Substitua app.js pelo app.js deste pacote.
3. NÃO altere catalogo.json nem style.css.
4. Faça Commit changes.

PASSO 4 — TESTAR
1. Aguarde o GitHub Pages publicar a alteração.
2. Abra o site e faça uma busca por um termo com pelo menos 2 caracteres.
3. Clique em Buscar ou pressione Enter. Digitar sem submeter não registra a busca.
4. Repita algumas buscas de teste, inclusive com termos diferentes.
5. Atualize a página. Os atalhos devem mostrar os termos mais pesquisados.
6. Para confirmar que a função está ligada, abra o Supabase e veja se há registros em public.keola_search_events. A função pública não permite consultar eventos individuais pela API; a tabela pode ser inspecionada no painel pelo proprietário do projeto.

NOTAS
- O ranking é calculado no banco a cada carregamento e considera apenas os últimos 30 dias.
- O termo é normalizado para minúsculas, sem acentos e pontuação; por isso, variantes com acentos são agrupadas. Expressões diferentes (ex.: "casamento" e "problemas casamento") permanecem separadas.
- Como o site é público, qualquer endpoint público pode receber abuso automatizado. Para uma versão de produção com proteção mais forte, use rate limiting via Edge Function ou CAPTCHA. Nunca exponha uma secret key.
- O código não consegue funcionar com ranking compartilhado até que você crie o projeto Supabase e configure URL e publishable key.
