# VozDiária

Um diário de voz: grave notas falando, e o app transcreve, organiza por
categoria e ainda detecta tarefas e compromissos ditos no áudio.

**Acesse em:** https://vozdiaria.vercel.app

---

## 🚀 Primeiro acesso

1. Abra o link acima no navegador (celular ou computador)
2. Toque em **"Não tem conta? Criar uma"**, digite seu e-mail e uma senha
3. Confira seu e-mail e clique no link de confirmação que o app envia
4. Volte e entre com o e-mail e senha — você vai ver uma tela de **"Aguardando aprovação"**
5. Alguém com acesso de administrador precisa liberar sua conta (veja a seção **Administração** abaixo). Depois de aprovado, é só entrar de novo e o app libera normalmente

## 🔑 Configurar a transcrição (uma vez só)

O app usa a **Groq** para transcrever os áudios e identificar tarefas — é gratuito, só precisa de uma chave pessoal:

1. Acesse **console.groq.com/keys** e crie uma conta (ou entre, se já tiver)
2. Clique em **Create API Key** e copie a chave (começa com `gsk_...`)
3. No VozDiária, abra a aba **Configurações** → **Chave Groq** → cole a chave e salve

Sem isso, o botão de gravar avisa que a chave está faltando.

---

## 📱 Como usar

- **Gravar**: escolha uma categoria, toque no botão pra começar. Enquanto grava, dá pra **pausar**, **cancelar** (descarta o áudio) ou tocar de novo no botão pra **finalizar** — a nota já libera a tela na hora e processa em segundo plano, então dá pra gravar a próxima sem esperar.
- **Notas**: lista todas as suas gravações já transcritas, com busca, filtro por categoria/data, reprodução do áudio e a contagem de tarefas que cada nota gerou.
- **Tarefas**: tudo que o app identificou como compromisso ou lembrete no que você falou, agrupado por categoria e com prazo quando dá pra entender (“amanhã”, “sexta-feira”...). Dá pra marcar como concluída ou apagar.
- **Relatórios**: resumo diário/semanal das suas notas, com exportação em PDF.
- **Configurações**: chave da Groq e suas categorias.
- **Lixeira** (notas e tarefas): apagar não é definitivo na hora — tudo vai pra uma lixeira (ícone no topo da aba Notas e da aba Tarefas), de onde dá pra restaurar ou excluir de vez.

---

## 🛡️ Administração

Toda conta nova precisa ser aprovada manualmente antes de conseguir usar o app — isso evita que qualquer pessoa com o link tenha acesso às notas de todo mundo.

Quem é administrador vê uma aba extra, **Admin**, com duas listas:
- **Pendentes**: contas que acabaram de se cadastrar, esperando decisão. Cada uma tem dois botões: **Aprovar** (libera o acesso) e **Recusar** (bloqueia a conta permanentemente).
- **Aprovados**: contas já liberadas, com um botão **Revogar** caso precise tirar o acesso de alguém depois.

---

## ❓ Dúvidas comuns

| Situação | O que fazer |
|---|---|
| Fico preso em "Aguardando aprovação" | Peça pra um administrador aprovar sua conta na aba Admin |
| Erro ao transcrever | Confira se a chave Groq está salva em Configurações e se ainda é válida |
| Não recebi o e-mail de confirmação | Confira a caixa de spam; o link expira depois de um tempo, tente criar a conta de novo se necessário |
| Apaguei uma nota ou tarefa sem querer | Abra a Lixeira (ícone no topo da aba Notas ou Tarefas) e restaure |
| A categoria que eu escolhi na aba Gravar mudou sozinha | Isso foi corrigido — atualize a página se ainda acontecer |
