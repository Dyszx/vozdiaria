// Groq Whisper Transcription Service
// ====================================
// Groq oferece Whisper Large V3 GRATUITAMENTE
// Free tier: 7.200 segundos (2 horas) de áudio por dia
//
// Para obter sua chave gratuita:
// 1. Acesse https://console.groq.com
// 2. Crie uma conta (gratuito, sem cartão)
// 3. Vá em API Keys > Create API Key
// 4. Cole a chave no app em Configurações

import AsyncStorage from '@react-native-async-storage/async-storage';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';

export async function transcribeAudio(audioUri: string): Promise<string> {
  const apiKey = await AsyncStorage.getItem('groq_api_key');

  if (!apiKey) {
    throw new Error('GROQ_KEY_MISSING');
  }

  const formData = new FormData();

  // Cria um arquivo temporário com extensão correta
  const fileName = `recording_${Date.now()}.m4a`;

  formData.append('file', {
    uri: audioUri,
    type: 'audio/m4a',
    name: fileName,
  } as any);

  formData.append('model', 'whisper-large-v3');
  formData.append('language', 'pt'); // Português
  formData.append('response_format', 'text');

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'multipart/form-data',
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Transcription failed: ${error}`);
  }

  const transcription = await response.text();
  return transcription.trim();
}
