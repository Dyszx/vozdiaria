// Groq Whisper Transcription Service
// ====================================
// Groq hospeda o Whisper (large-v3) com inferência muito rápida — free tier
// generoso, sem custo até os limites diários do plano gratuito.
//
// Para obter sua chave gratuita:
// 1. Acesse https://console.groq.com/keys
// 2. Faça login (ou crie uma conta)
// 3. Clique em "Create API Key"
// 4. Cole a chave no app em Configurações

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const GROQ_WHISPER_MODEL = 'whisper-large-v3';
export const GROQ_TRANSCRIPTION_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';

// 503 (sobrecarga) e 429 (rate limit) são picos passageiros do lado da Groq —
// vale tentar de novo antes de mostrar erro pro usuário.
const RETRYABLE_STATUS = new Set([503, 429]);
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchGroqWithRetry(url: string, options: RequestInit): Promise<Response> {
  let response: Response;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    response = await fetch(url, options);
    const shouldRetry = RETRYABLE_STATUS.has(response.status) && attempt < MAX_ATTEMPTS;
    if (!shouldRetry) return response;
    await sleep(RETRY_DELAY_MS * attempt);
  }
  return response!;
}

export async function transcribeAudio(audioUri: string): Promise<string> {
  const apiKey = await AsyncStorage.getItem('groq_api_key');

  if (!apiKey) {
    throw new Error('GROQ_KEY_MISSING');
  }

  const formData = new FormData();

  if (Platform.OS === 'web') {
    // No navegador a gravação é um blob: URL (audio/webm) — buscamos o Blob direto.
    const blob = await (await fetch(audioUri)).blob();
    formData.append('file', blob, 'audio.webm');
  } else {
    formData.append('file', {
      uri: audioUri,
      name: 'audio.m4a',
      type: 'audio/m4a',
    } as any);
  }

  formData.append('model', GROQ_WHISPER_MODEL);
  formData.append('language', 'pt');

  const response = await fetchGroqWithRetry(GROQ_TRANSCRIPTION_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    let message = errorText;
    try {
      message = JSON.parse(errorText)?.error?.message ?? errorText;
    } catch {
      // resposta não era JSON, usa o texto cru mesmo
    }
    throw new Error(`Groq (${response.status}): ${message}`);
  }

  const json = await response.json();
  const text = json?.text;

  if (!text) {
    throw new Error('Transcription failed: resposta vazia da Groq');
  }

  return text.trim();
}
