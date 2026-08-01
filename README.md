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
   - Isso cria as tabelas `entries` e `categories`, as políticas de RLS e o bucket de áudio `audios`
6. Vá em **Project Settings > API**
7. Copie a **Project URL** e a chave **anon public**
8. Abra o arquivo `services/supabase.ts` e substitua `SUPABASE_URL` e `SUPABASE_ANON_KEY`
9. (Opcional) Em **Authentication > Providers**, ative o Google (ou outro provedor) se quiser login social

---

## 🔑 Passo 3 — Obter Chave Groq (Gratuita)

1. Acesse **https://console.groq.com**
2. Crie uma conta gratuita (sem cartão de crédito)
3. Vá em **API Keys** → **Create API Key**
4. Copie a chave (começa com `gsk_...`)
5. No app, abra a aba **Configurações** e cole a chave

> ✅ O Groq oferece **6.000 minutos/mês** de transcrição Whisper Large V3 no plano gratuito.

---

## 📱 Passo 4 — Executar o App

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

---

## 🗂️ Estrutura do Projeto

```
VozDiaria/
├── app/
│   ├── (tabs)/
│   │   ├── index.tsx       ← Tela de Gravação
│   │   ├── entries.tsx     ← Lista de Notas
│   │   ├── reports.tsx     ← Relatórios
│   │   └── settings.tsx    ← Configurações
│   └── _layout.tsx
├── services/
│   ├── supabase.ts         ← ⚠️ Configure aqui suas credenciais
│   ├── transcription.ts    ← Integração Groq Whisper
│   ├── entries.ts          ← CRUD das notas
│   └── reports.ts          ← Geração de relatórios
├── hooks/
│   └── useAudioRecorder.ts ← Lógica de gravação
├── context/
│   └── AuthContext.tsx     ← Autenticação Supabase
├── supabase/
│   └── schema.sql          ← Tabelas, RLS e bucket de áudio
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
| App não abre no celular | Verifique se está na mesma rede Wi-Fi que o computador |

---

## 📊 Funcionalidades

- 🎙️ **Gravação** com pausar/retomar e seleção de categoria
- 🤖 **Transcrição automática** em português via Groq Whisper
- 📋 **Lista de notas** com busca, filtros e reprodução de áudio
- 📊 **Relatórios diários e semanais** com linha do tempo
- 📄 **Exportar PDF** para compartilhar relatórios
- ☁️ **Sincronização** em nuvem via Supabase
