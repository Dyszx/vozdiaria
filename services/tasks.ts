// Tasks Service — extracts actionable tasks from transcribed audio and manages their lifecycle
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from './supabase';
import { fetchGroqWithRetry } from './transcription';

const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_TASK_MODEL = 'llama-3.3-70b-versatile';

export interface Task {
  id?: string;
  entryId: string | null;
  title: string;
  dueDate: Date | null;
  done: boolean;
  source: 'ai' | 'keyword';
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  createdAt: Date;
  completedAt: Date | null;
  userId: string;
}

type ExtractedTask = Pick<Task, 'title' | 'dueDate' | 'source'>;

function rowToTask(row: any): Task {
  return {
    id: row.id,
    entryId: row.entry_id,
    title: row.title,
    dueDate: row.due_date ? new Date(row.due_date) : null,
    done: row.done,
    source: row.source,
    categoryId: row.category_id,
    categoryName: row.category_name,
    categoryColor: row.category_color,
    createdAt: new Date(row.created_at),
    completedAt: row.completed_at ? new Date(row.completed_at) : null,
    userId: row.user_id,
  };
}

// Gatilhos comuns em PT-BR para compromissos/lembretes/tarefas ditos em voz alta
const KEYWORD_TRIGGERS =
  /\b(preciso|tenho que|tenho de|n[aã]o posso esquecer|n[aã]o esquecer|lembrar de|marcar|agendar|ligar para|ligar pro|ligar pra|enviar|comprar|pagar)\b/i;

// Divide a transcrição em frases e devolve as que batem com algum gatilho de tarefa.
// Sem IA não arriscamos inferir prazo a partir de texto livre — melhor sem data do que uma data errada.
export function extractTasksByKeyword(text: string): ExtractedTask[] {
  const sentences = text
    .split(/(?<=[.!?\n])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  return sentences
    .filter((sentence) => KEYWORD_TRIGGERS.test(sentence))
    .map((sentence) => ({
      title: sentence.replace(/[.!?]+$/, '').trim(),
      dueDate: null,
      source: 'keyword' as const,
    }));
}

// Pede pra Groq (texto, via Llama) identificar tarefas/compromissos e, quando
// possível, inferir a data a partir de expressões relativas ("amanhã", "sexta-feira").
export async function extractTasksWithAI(
  text: string,
  referenceDate: Date,
  apiKey: string
): Promise<ExtractedTask[]> {
  const readableDate = format(referenceDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR });

  const prompt = `Hoje é ${readableDate}.
Leia o texto abaixo (transcrição de um áudio) e identifique compromissos, lembretes ou tarefas que a pessoa precisa fazer. Ignore o que for só relato, opinião ou desabafo.

Responda em JSON no formato {"tasks": [{"title": string curto no imperativo, "due_date": "YYYY-MM-DD" ou null}]}.
Se não houver nenhuma tarefa, responda {"tasks": []}.

Texto: "${text}"`;

  const response = await fetchGroqWithRetry(GROQ_CHAT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: GROQ_TASK_MODEL,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    throw new Error(`Groq (${response.status}): falha ao extrair tarefas`);
  }

  const json = await response.json();
  const rawText = json?.choices?.[0]?.message?.content;
  if (!rawText) throw new Error('Extração de tarefas: resposta vazia da Groq');

  const parsed = JSON.parse(rawText);
  if (!Array.isArray(parsed?.tasks)) throw new Error('Extração de tarefas: resposta em formato inesperado');

  return parsed.tasks
    .filter((item: any) => item && typeof item.title === 'string' && item.title.trim())
    .map((item: any) => ({
      title: item.title.trim(),
      dueDate: item.due_date ? new Date(item.due_date) : null,
      source: 'ai' as const,
    }));
}

// Orquestra a extração: tenta a IA primeiro (mais precisa, entende datas relativas);
// se não houver chave configurada ou a chamada falhar, cai pro fallback local de palavra-chave.
// Nunca lança erro — uma falha de extração não pode impedir o salvamento da nota.
export async function extractTasks(text: string, referenceDate: Date): Promise<ExtractedTask[]> {
  const apiKey = await AsyncStorage.getItem('groq_api_key');

  if (apiKey) {
    try {
      return await extractTasksWithAI(text, referenceDate, apiKey);
    } catch (error) {
      console.error('Task extraction (AI) failed, falling back to keyword scan:', error);
    }
  }

  try {
    return extractTasksByKeyword(text);
  } catch (error) {
    console.error('Task extraction (keyword) failed:', error);
    return [];
  }
}

// Salva em lote as tarefas encontradas para uma nota recém-criada. A categoria é
// copiada da nota (mesmo padrão de entries.ts) pra sobreviver caso a categoria
// original seja apagada depois — a tarefa só perde o vínculo vivo, não o rótulo.
export async function createTasksForEntry(
  found: ExtractedTask[],
  entryId: string,
  userId: string,
  category: { id: string; name: string; color: string }
): Promise<void> {
  if (found.length === 0) return;

  const { error } = await supabase.from('tasks').insert(
    found.map((task) => ({
      entry_id: entryId,
      user_id: userId,
      title: task.title,
      due_date: task.dueDate ? task.dueDate.toISOString() : null,
      source: task.source,
      category_id: category.id,
      category_name: category.name,
      category_color: category.color,
    }))
  );

  if (error) throw error;
}

export async function getTasks(userId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .order('due_date', { ascending: true, nullsFirst: false });

  if (error) throw error;
  return (data ?? []).map(rowToTask);
}

export async function toggleTaskDone(taskId: string, done: boolean): Promise<void> {
  const { error } = await supabase
    .from('tasks')
    .update({ done, completed_at: done ? new Date().toISOString() : null })
    .eq('id', taskId);

  if (error) throw error;
}

export async function deleteTask(taskId: string): Promise<void> {
  const { error } = await supabase.from('tasks').delete().eq('id', taskId);
  if (error) throw error;
}
