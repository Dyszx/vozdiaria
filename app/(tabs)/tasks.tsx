// Tasks Screen — checklist of tasks auto-extracted from voice notes, grouped by category
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { format, isToday, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useFocusEffect } from 'expo-router';
import { alert } from '../../utils/alert';
import {
  getTasks,
  toggleTaskDone,
  deleteTask,
  getDeletedTasks,
  restoreTask,
  permanentlyDeleteTask,
  permanentlyDeleteAllTasks,
  Task,
} from '../../services/tasks';
import { getCategories, Category } from '../../services/entries';
import { COLORS, SPACING, RADIUS, FONT, SHADOW } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';

interface Section {
  key: string;
  label: string;
  color: string | null; // null = seção "Concluídas" (usa ícone em vez de bolinha)
  tasks: Task[];
}

function dueDateColor(task: Task): string {
  if (!task.dueDate) return COLORS.textMuted;
  if (isPast(task.dueDate) && !isToday(task.dueDate)) return COLORS.accentDanger;
  if (isToday(task.dueDate)) return COLORS.accentWarn;
  return COLORS.textSecondary;
}

function compareByDueDate(a: Task, b: Task): number {
  if (!a.dueDate && !b.dueDate) return 0;
  if (!a.dueDate) return 1;
  if (!b.dueDate) return -1;
  return a.dueDate.getTime() - b.dueDate.getTime();
}

// Agrupa as tarefas pendentes por categoria, na mesma ordem das categorias do
// usuário; tarefas de categorias já excluídas (ou de antes dessa coluna existir)
// caem numa seção "Sem categoria" separada por nome, pra não misturar categorias
// diferentes que já foram apagadas.
function buildCategorySections(pending: Task[], categories: Category[]): Section[] {
  const byKey = new Map<string, Section>();

  for (const task of pending) {
    const key = task.categoryId ?? `orphan:${task.categoryName ?? 'none'}`;
    if (!byKey.has(key)) {
      byKey.set(key, {
        key,
        label: task.categoryName ?? 'Sem categoria',
        color: task.categoryColor ?? COLORS.textMuted,
        tasks: [],
      });
    }
    byKey.get(key)!.tasks.push(task);
  }

  const ordered: Section[] = [];
  for (const cat of categories) {
    const section = byKey.get(cat.id!);
    if (section) {
      ordered.push(section);
      byKey.delete(cat.id!);
    }
  }
  // Sobras: categorias que a tarefa guarda mas que não estão mais na lista atual do usuário.
  ordered.push(...byKey.values());

  return ordered.map((section) => ({ ...section, tasks: [...section.tasks].sort(compareByDueDate) }));
}

interface TaskRowProps {
  task: Task;
  onToggle: (task: Task) => void;
  onDelete: (task: Task) => void;
}

function TaskRow({ task, onToggle, onDelete }: TaskRowProps) {
  return (
    <View style={styles.row}>
      <TouchableOpacity onPress={() => onToggle(task)} style={styles.checkbox}>
        <Ionicons
          name={task.done ? 'checkmark-circle' : 'ellipse-outline'}
          size={24}
          color={task.done ? COLORS.success : COLORS.textMuted}
        />
      </TouchableOpacity>

      <View style={styles.rowBody}>
        <Text style={[styles.rowTitle, task.done && styles.rowTitleDone]}>{task.title}</Text>
        {task.dueDate && (
          <Text style={[styles.rowDate, { color: dueDateColor(task) }]}>
            {format(task.dueDate, "dd 'de' MMMM", { locale: ptBR })}
          </Text>
        )}
      </View>

      <TouchableOpacity onPress={() => onDelete(task)} style={styles.iconAction}>
        <Ionicons name="trash-outline" size={18} color={COLORS.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

interface TrashItemProps {
  task: Task;
  onRestore: (task: Task) => void;
  onDeleteForever: (task: Task) => void;
}

function TrashItem({ task, onRestore, onDeleteForever }: TrashItemProps) {
  return (
    <View style={styles.trashItem}>
      <View style={{ flex: 1 }}>
        <Text style={styles.trashItemText}>{task.title}</Text>
        {task.deletedAt && (
          <Text style={styles.trashItemDate}>
            Excluída {format(task.deletedAt, "dd/MM 'às' HH:mm")}
          </Text>
        )}
      </View>
      <TouchableOpacity onPress={() => onRestore(task)} style={styles.iconAction}>
        <Ionicons name="arrow-undo-outline" size={20} color={COLORS.primary} />
      </TouchableOpacity>
      <TouchableOpacity onPress={() => onDeleteForever(task)} style={styles.iconAction}>
        <Ionicons name="trash-outline" size={20} color={COLORS.error} />
      </TouchableOpacity>
    </View>
  );
}

export default function TasksScreen() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDone, setShowDone] = useState(false);

  const [showTrash, setShowTrash] = useState(false);
  const [deletedTasks, setDeletedTasks] = useState<Task[]>([]);
  const [loadingTrash, setLoadingTrash] = useState(false);

  const loadTasks = useCallback(async () => {
    if (!user) return;
    const [data, cats] = await Promise.all([getTasks(user.id), getCategories(user.id)]);
    setTasks(data);
    setCategories(cats);
    setLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadTasks();
    }, [loadTasks])
  );

  const loadTrash = useCallback(async () => {
    if (!user) return;
    setLoadingTrash(true);
    const data = await getDeletedTasks(user.id);
    setDeletedTasks(data);
    setLoadingTrash(false);
  }, [user]);

  const openTrash = () => {
    setShowTrash(true);
    loadTrash();
  };

  const handleToggle = async (task: Task) => {
    if (!task.id) return;
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, done: !t.done } : t)));
    await toggleTaskDone(task.id, !task.done);
  };

  const handleDelete = (task: Task) => {
    alert('Mover para Lixeira', 'A tarefa vai para a lixeira e pode ser restaurada depois.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          if (!task.id) return;
          await deleteTask(task.id);
          await loadTasks();
        },
      },
    ]);
  };

  const handleRestore = async (task: Task) => {
    if (!task.id) return;
    await restoreTask(task.id);
    await Promise.all([loadTrash(), loadTasks()]);
  };

  const handlePermanentDelete = (task: Task) => {
    alert('Excluir Definitivamente', 'Esta tarefa será apagada para sempre. Não é possível desfazer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir para sempre',
        style: 'destructive',
        onPress: async () => {
          if (!task.id) return;
          await permanentlyDeleteTask(task.id);
          await loadTrash();
        },
      },
    ]);
  };

  const handleEmptyTrash = () => {
    if (deletedTasks.length === 0) return;
    alert(
      'Esvaziar Lixeira',
      `Todas as ${deletedTasks.length} tarefa${deletedTasks.length !== 1 ? 's' : ''} da lixeira serão apagadas para sempre. Não é possível desfazer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir tudo',
          style: 'destructive',
          onPress: async () => {
            await permanentlyDeleteAllTasks(deletedTasks.map((t) => t.id!).filter(Boolean));
            await loadTrash();
          },
        },
      ]
    );
  };

  const pending = tasks.filter((t) => !t.done);
  const doneTasks = tasks.filter((t) => t.done);

  const sections = buildCategorySections(pending, categories);
  if (showDone && doneTasks.length > 0) {
    sections.push({ key: 'done', label: 'Concluídas', color: null, tasks: doneTasks });
  }

  if (loading) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#0F0F1A', '#1A1A2E']} style={StyleSheet.absoluteFill} />

      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Tarefas</Text>
          <Text style={styles.subtitle}>
            {pending.length} pendente{pending.length !== 1 ? 's' : ''}
          </Text>
        </View>
        {doneTasks.length > 0 && (
          <TouchableOpacity style={styles.doneToggle} onPress={() => setShowDone((v) => !v)}>
            <Text style={styles.doneToggleText}>
              {showDone ? 'Ocultar concluídas' : `Ver concluídas (${doneTasks.length})`}
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.trashBtn} onPress={openTrash}>
          <Ionicons name="trash-bin-outline" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      {tasks.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="checkmark-done-outline" size={56} color={COLORS.textMuted} />
          <Text style={styles.emptyTitle}>Nenhuma tarefa por aqui</Text>
          <Text style={styles.emptySubtitle}>
            Grave uma nota falando um compromisso e ela aparece aqui automaticamente.
          </Text>
        </View>
      ) : (
        <FlatList
          data={sections}
          keyExtractor={(section) => section.key}
          contentContainerStyle={styles.listContent}
          renderItem={({ item: section }) => (
            <View>
              <View style={styles.sectionHeaderRow}>
                {section.color ? (
                  <View style={[styles.categoryDot, { backgroundColor: section.color }]} />
                ) : (
                  <Ionicons name="checkmark-done" size={12} color={COLORS.textMuted} />
                )}
                <Text style={styles.sectionHeader}>{section.label}</Text>
              </View>
              <View style={styles.card}>
                {section.tasks.map((task, index) => (
                  <View key={task.id}>
                    <TaskRow task={task} onToggle={handleToggle} onDelete={handleDelete} />
                    {index < section.tasks.length - 1 && <View style={styles.divider} />}
                  </View>
                ))}
              </View>
            </View>
          )}
        />
      )}

      {/* Trash Modal */}
      <Modal visible={showTrash} transparent animationType="slide" onRequestClose={() => setShowTrash(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, styles.trashCard]}>
            <View style={styles.trashHeader}>
              <Text style={styles.modalTitle}>Lixeira</Text>
              <View style={styles.trashHeaderActions}>
                {deletedTasks.length > 0 && (
                  <TouchableOpacity onPress={handleEmptyTrash}>
                    <Text style={styles.emptyTrashText}>Excluir tudo</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => setShowTrash(false)}>
                  <Ionicons name="close" size={24} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            {loadingTrash ? (
              <ActivityIndicator color={COLORS.primary} style={{ marginVertical: SPACING.xl }} />
            ) : deletedTasks.length === 0 ? (
              <Text style={styles.emptySubtitle}>Nenhuma tarefa na lixeira.</Text>
            ) : (
              <FlatList
                data={deletedTasks}
                keyExtractor={(item) => item.id!}
                style={{ flex: 1 }}
                renderItem={({ item }) => (
                  <TrashItem task={item} onRestore={handleRestore} onDeleteForever={handlePermanentDelete} />
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  title: { fontSize: 24, color: COLORS.text, ...FONT.bold },
  subtitle: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
  doneToggle: { paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border },
  doneToggleText: { color: COLORS.textSecondary, fontSize: 12, ...FONT.medium },
  trashBtn: { marginLeft: SPACING.sm, padding: SPACING.sm, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border },

  listContent: { paddingHorizontal: SPACING.lg, paddingBottom: 100 },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  categoryDot: { width: 8, height: 8, borderRadius: 4 },
  sectionHeader: {
    fontSize: 12,
    color: COLORS.textMuted,
    letterSpacing: 1,
    ...FONT.semibold,
    textTransform: 'uppercase',
  },

  card: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    ...SHADOW.card,
  },
  divider: { height: 1, backgroundColor: COLORS.border },

  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.sm },
  checkbox: { padding: 2 },
  rowBody: { flex: 1 },
  rowTitle: { color: COLORS.text, fontSize: 15 },
  rowTitleDone: { color: COLORS.textMuted, textDecorationLine: 'line-through' },
  rowDate: { fontSize: 12, marginTop: 2, textTransform: 'capitalize' },
  iconAction: { padding: 4 },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.md, paddingHorizontal: SPACING.xl },
  emptyTitle: { fontSize: 18, color: COLORS.text, ...FONT.semibold },
  emptySubtitle: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: SPACING.lg },
  modalCard: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.border },
  modalTitle: { fontSize: 18, color: COLORS.text, ...FONT.bold, marginBottom: SPACING.md },

  trashCard: { height: '65%' },
  trashHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.md },
  trashHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  emptyTrashText: { color: COLORS.error, fontSize: 13, ...FONT.semibold },
  trashItem: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm, paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  trashItemText: { color: COLORS.text, fontSize: 14 },
  trashItemDate: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
});
