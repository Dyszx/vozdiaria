// Gemini Transcription Service
// ====================================
// O Gemini transcreve áudio nativamente via generateContent (áudio inline em base64).
// Free tier generoso (Gemini Flash): sem custo até os limites de requisições/dia.
//
// Para obter sua chave gratuita:
// 1. Acesse https://aistudio.google.com/apikey
// 2. Faça login com sua conta Google
// 3. Clique em "Create API Key"
// 4. Cole a chave no app em Configurações

import { Platform } from 'react-native';
import { File } from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const GEMINI_MODEL = 'gemini-3.6-flash';
export const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const TRANSCRIPTION_PROMPT =
  'Transcreva o áudio a seguir literalmente em português do Brasil. Responda apenas com o texto transcrito, sem comentários, aspas ou formatação adicional.';

// 503 (sobrecarga) e 429 (rate limit) são picos passageiros do lado do Google —
// vale tentar de novo antes de mostrar erro pro usuário.
const RETRYABLE_STATUS = new Set([503, 429]);
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchGeminiWithRetry(url: string, options: RequestInit): Promise<Response> {
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
  const apiKey = await AsyncStorage.getItem('gemini_api_key');

  if (!apiKey) {
    throw new Error('GEMINI_KEY_MISSING');
  }

  let base64Audio: string;
  let mimeType: string;

  if (Platform.OS === 'web') {
    // No navegador a gravação é um blob: URL (audio/webm) — convertemos pra base64 via FileReader.
    const blob = await (await fetch(audioUri)).blob();
    base64Audio = await blobToBase64(blob);
    mimeType = 'audio/webm';
  } else {
    base64Audio = await new File(audioUri).base64();
    mimeType = 'audio/m4a';
  }

  const response = await fetchGeminiWithRetry(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: TRANSCRIPTION_PROMPT },
            { inline_data: { mime_type: mimeType, data: base64Audio } },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let message = errorText;
    try {
      message = JSON.parse(errorText)?.error?.message ?? errorText;
    } catch {
      // resposta não era JSON, usa o texto cru mesmo
    }
    throw new Error(`Gemini (${response.status}): ${message}`);
  }

  const json = await response.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error('Transcription failed: resposta vazia do Gemini');
  }

  return text.trim();
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
