// Recording Queue Hook — lets the user keep recording while previous audios
// are still being transcribed, saved and mined for tasks in the background.
import { useEffect, useState } from 'react';
import { transcribeAudio } from '../services/transcription';
import { createEntry } from '../services/entries';
import { extractTasks, createTasksForEntry } from '../services/tasks';

export type QueueItemStatus = 'pending' | 'transcribing' | 'saving' | 'error' | 'done';

export interface QueueItem {
  id: string;
  audioUri: string;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  duration: number;
  createdAt: Date;
  userId: string;
  status: QueueItemStatus;
  errorMessage?: string;
}

const DONE_REMOVAL_DELAY_MS = 3000;

export function useRecordingQueue() {
  const [queue, setQueue] = useState<QueueItem[]>([]);

  const updateItem = (id: string, patch: Partial<QueueItem>) => {
    setQueue((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const dismissItem = (id: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== id));
  };

  const enqueue = (input: Omit<QueueItem, 'id' | 'status'>) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setQueue((prev) => [...prev, { ...input, id, status: 'pending' }]);
  };

  const retryItem = (id: string) => {
    updateItem(id, { status: 'pending', errorMessage: undefined });
  };

  // Processa um item por vez: se algum já está em andamento, não faz nada — a
  // própria mudança de status dele (ao terminar) já vai disparar este efeito
  // de novo e liberar o próximo pendente. Não precisa de loop nem de lock manual.
  useEffect(() => {
    const isProcessing = queue.some((item) => item.status === 'transcribing' || item.status === 'saving');
    if (isProcessing) return;

    const next = queue.find((item) => item.status === 'pending');
    if (!next) return;

    updateItem(next.id, { status: 'transcribing' });

    (async () => {
      try {
        const text = await transcribeAudio(next.audioUri);
        updateItem(next.id, { status: 'saving' });

        const entryId = await createEntry(
          {
            text,
            audioUrl: '',
            categoryId: next.categoryId,
            categoryName: next.categoryName,
            categoryColor: next.categoryColor,
            createdAt: next.createdAt,
            duration: next.duration,
            edited: false,
            userId: next.userId,
            deletedAt: null,
          },
          next.audioUri
        );

        try {
          const foundTasks = await extractTasks(text, next.createdAt);
          if (foundTasks.length > 0) {
            await createTasksForEntry(foundTasks, entryId, next.userId);
          }
        } catch (taskError) {
          console.error('Task extraction error:', taskError);
        }

        updateItem(next.id, { status: 'done' });
        setTimeout(() => dismissItem(next.id), DONE_REMOVAL_DELAY_MS);
      } catch (error: any) {
        const message =
          error?.message === 'GEMINI_KEY_MISSING'
            ? 'Chave Gemini não configurada'
            : String(error?.message ?? error);
        updateItem(next.id, { status: 'error', errorMessage: message });
      }
    })();
  }, [queue]);

  return { queue, enqueue, retryItem, dismissItem };
}
