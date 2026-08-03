# VozDiária — Guia de Instalação e Configuração

## 📋 Pré-requisitos

Antes de começar, você precisa ter instalado:
- **Node.js LTS** → https://nodejs.org
- **Git** (opcional) → https://git-scm.com
- **Android Studio** (para emulador) OU o app **Expo Go** no celular

---

## 🚀 Passo 1 — Instalar Dependências

Abra o PowerShell na pasta do projeto e execute:

```powershell
cd "C:\Users\Filhos\OneDrive\Documentos\Consultor\VozDiaria"
npm install
```

Aguarde o download de todas as bibliotecas (pode levar alguns minutos na primeira vez).

---

## 🔥 Passo 2 — Configurar Supabase (Gratuito)

1. Acesse **https://supabase.com** e crie uma conta gratuita
2. Clique em **"New project"** → Nome: `VozDiaria`
3. Aguarde o projeto ser provisionado (~2 minutos)
4. No menu lateral, clique em **SQL Editor** → **New query**
5. Cole todo o conteúdo do arquivo `supabase/schema.sql` deste projeto e execute (▶ Run)
   - Isso cria as tabelas `entries`, `categories`, `tasks` e `profiles`, as políticas de RLS, o bucket de áudio `audios` e o gatilho que cria um perfil pra toda conta nova
6. Vá em **Project Settings > API**
7. Copie a **Project URL** e a chave **anon public**
8. Abra o arquivo `services/supabase.ts` e substitua `SUPABASE_URL` e `SUPABASE_ANON_KEY`

---

## 🔒 Passo 3 — Login obrigatório e aprovação de contas

O app não tem mais modo anônimo: **toda conta precisa de e-mail/senha, e só é liberada depois de um admin aprovar** — mesmo a sua conta na primeira vez.

1. Abra o app e crie sua conta (e-mail + senha) na tela de login
2. Confirme o e-mail que o Supabase enviar
3. Volte ao **SQL Editor** do Supabase e ache seu UID:
   ```sql
   select id, email from auth.users order by created_at desc;
   ```
4. Torne essa conta admin aprovado (substitua o UID e o e-mail pelos seus):
   ```sql
   insert into profiles (id, email, approved, is_admin)
   values ('SEU-UID-AQUI', 'seu@email.com', true, true)
   on conflict (id) do update set approved = true, is_admin = true;
   ```
5. Entre no app de novo — sua conta já aparece como **Admin** em Configurações

Esse passo 3 só precisa ser feito manualmente **uma vez**, pra criar o primeiro admin. Depois disso, novas contas se cadastram normalmente pela tela de login e ficam com o acesso pendente até você (admin) aprovar na aba **Admin** do app.

---

## 🔑 Passo 4 — Obter Chave Groq (Gratuita)

1. Acesse **https://console.groq.com/keys**
2. Faça login (ou crie uma conta gratuita)
3. Clique em **Create API Key**
4. Copie a chave (começa com `gsk_...`)
5. No app, abra a aba **Configurações** e cole a chave

> ✅ A Groq oferece transcrição (Whisper) e interpretação de tarefas gratuitas dentro dos limites diários do plano gratuito.

---

## 📱 Passo 5 — Executar o App

### Opção A — Testar no Celular com Expo Go (Mais Simples)
```powershell
npm start
```
1. Instale o app **Expo Go** na Play Store
2. Escaneie o QR Code que aparecer no terminal
3. O app vai abrir diretamente no seu celular!

### Opção B — Emulador Android (Android Studio)
```powershell
npm run android
```
Requer Android Studio instalado com um AVD configurado.

### Opção C — Web (produção, ex: Vercel)
```powershell
npx expo export --platform web
```
Gera a pasta `dist/` pronta pra hospedar (é o comando que o `vercel.json` já usa automaticamente a cada push).

---

## 🗂️ Estrutura do Projeto

```
VozDiaria/
├── app/
│   ├── (tabs)/
│   │   ├── index.tsx       ← Tela de Gravação (fila de processamento em segundo plano)
│   │   ├── entries.tsx     ← Lista de Notas
│   │   ├── tasks.tsx       ← Tarefas extraídas dos áudios, agrupadas por categoria
│   │   ├── reports.tsx     ← Relatórios
│   │   ├── settings.tsx    ← Configurações
│   │   └── admin.tsx       ← Aprovação de contas (só visível pra admins)
│   └── _layout.tsx         ← Gate de login/aprovação
├── services/
│   ├── supabase.ts         ← ⚠️ Configure aqui suas credenciais
│   ├── transcription.ts    ← Integração Groq (transcrição de áudio via Whisper)
│   ├── entries.ts          ← CRUD das notas
│   ├── tasks.ts            ← Extração de tarefas (IA + palavra-chave) e CRUD
│   ├── profiles.ts         ← Aprovação de contas (admin-only, via RLS)
│   └── reports.ts          ← Geração de relatórios
├── hooks/
│   ├── useAudioRecorder.ts   ← Lógica de gravação
│   └── useRecordingQueue.ts  ← Fila: transcreve/salva/extrai tarefas em segundo plano
├── context/
│   └── AuthContext.tsx     ← Autenticação Supabase (login, aprovação, admin)
├── supabase/
│   └── schema.sql          ← Tabelas, RLS, bucket de áudio e perfis
└── constants/
    └── theme.ts            ← Cores e estilos
```

---

## ❓ Problemas Comuns

| Erro | Solução |
|---|---|
| `node: command not found` | Reinstale o Node.js e feche/abra o terminal |
| `Cannot find module 'expo'` | Execute `npm install` novamente |
| Erro de Supabase | Verifique se as credenciais em `services/supabase.ts` estão corretas e se `supabase/schema.sql` foi executado |
| Erro de transcrição | Verifique se a chave Groq está configurada nas Configurações |
| Fico preso em "Aguardando aprovação" | Um admin precisa aprovar sua conta na aba Admin (ou, pro primeiro admin, veja o Passo 3) |
| App não abre no celular | Verifique se está na mesma rede Wi-Fi que o computador |

---

## 📊 Funcionalidades

- 🔒 **Login obrigatório** por e-mail/senha, com aprovação manual de novas contas por um admin
- 🎙️ **Gravação** com pausar/retomar/cancelar e seleção de categoria
- 🚀 **Fila de processamento**: grava a próxima nota sem esperar a anterior transcrever
- 🤖 **Transcrição automática** em português via Groq (Whisper)
- ✅ **Extração automática de tarefas** ditas no áudio, agrupadas por categoria e com prazo interpretado pela IA
- 📋 **Lista de notas** com busca, filtros, reprodução de áudio e contagem de tarefas por nota
- 📊 **Relatórios diários e semanais** com linha do tempo
- 📄 **Exportar PDF** para compartilhar relatórios
- ☁️ **Sincronização** em nuvem via Supabase
