// Entries List Screen — browse, search and filter notes
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { format, isToday, isYesterday, isThisWeek, startOfDay, startOfWeek, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { alert } from '../../utils/alert';
import {
  Entry,
  getEntries,
  deleteEntry,
  updateEntryText,
  updateEntryCategory,
  getCategories,
  Category,
  getDeletedEntries,
  restoreEntry,
  permanentlyDeleteEntry,
  permanentlyDeleteAllEntries,
} from '../../services/entries';
import { getTasks } from '../../services/tasks';
import { COLORS, SPACING, RADIUS, FONT, SHADOW } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { formatDuration } from '../../services/reports';
import { useFocusEffect } from 'expo-router';

type DateFilter = 'all' | 'today' | 'week' | 'month';

function formatRelativeDate(date: Date): string {
  if (isToday(date)) return 'Hoje';
  if (isYesterday(date)) return 'Ontem';
  if (isThisWeek(date)) return format(date, 'EEEE', { locale: ptBR });
  return format(date, "dd 'de' MMMM", { locale: ptBR });
}

// Remove acentos, baixa a caixa e colapsa espaços — deixa a busca tolerante a
// pequenas diferenças de digitação (ex: "cafe" encontra "café", espaço extra não quebra a busca).
function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function matchesSearch(text: string, query: string): boolean {
  const words = normalize(query).split(' ').filter(Boolean);
  if (words.length === 0) return true;
  const normalizedText = normalize(text);
  return words.every((word) => normalizedText.includes(word));
}

interface EntryCardProps {
  entry: Entry;
  taskCount: number;
  onDelete: (entry: Entry) => void;
  onEdit: (entry: Entry) => void;
  onChangeCategory: (entry: Entry) => void;
}

interface TrashItemProps {
  entry: Entry;
  onRestore: (entry: Entry) => void;
  onDeleteForever: (entry: Entry) => void;
}

function TrashItem({ entry, onRestore, onDeleteForever }: TrashItemProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.trashItem}>
      <TouchableOpacity activeOpacity={0.7} style={{ flex: 1 }} onPress={() => setExpanded((v) => !v)}>
        <Text style={styles.trashItemText} numberOfLines={expanded ? undefined : 2}>{entry.text}</Text>
        <Text style={styles.expandText}>{expanded ? 'Ver menos' : 'Ver mais'}</Text>
        {entry.deletedAt && (
          <Text style={styles.trashItemDate}>
            Excluída {format(entry.deletedAt, "dd/MM 'às' HH:mm")}
          </Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity onPress={() => onRestore(entry)} style={styles.iconAction}>
        <Ionicons name="arrow-undo-outline" size={20} color={COLORS.primary} />
      </TouchableOpacity>
      <TouchableOpacity onPress={() => onDeleteForever(entry)} style={styles.iconAction}>
        <Ionicons name="trash-outline" size={20} color={COLORS.error} />
      </TouchableOpacity>
    </View>
  );
}

function EntryCard({ entry, taskCount, onDelete, onEdit, onChangeCategory }: EntryCardProps) {
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handlePlayPause = async () => {
    try {
      if (status.playing) {
        player.pause();
        return;
      }
      if (!loaded) {
        player.replace({ uri: entry.audioUrl });
        setLoaded(true);
      }
      player.play();
    } catch {
      alert('Erro', 'Não foi possível reproduzir o áudio.');
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <TouchableOpacity
          style={[styles.categoryBadge, { backgroundColor: entry.categoryColor + '20', borderColor: entry.categoryColor + '50' }]}
          onPress={() => onChangeCategory(entry)}
        >
          <View style={[styles.categoryDot, { backgroundColor: entry.categoryColor }]} />
          <Text style={[styles.categoryText, { color: entry.categoryColor }]}>{entry.categoryName}</Text>
          <Ionicons name="chevron-down" size={12} color={entry.categoryColor} />
        </TouchableOpacity>
        <Text style={styles.timeText}>{format(entry.createdAt, 'HH:mm')}</Text>
      </View>

      <TouchableOpacity activeOpacity={0.7} onPress={() => setExpanded((v) => !v)}>
        <Text style={styles.entryText} numberOfLines={expanded ? undefined : 4}>
          {entry.text}
        </Text>
        <Text style={styles.expandText}>{expanded ? 'Ver menos' : 'Ver mais'}</Text>
      </TouchableOpacity>

      <View style={styles.cardFooter}>
        <TouchableOpacity style={styles.footerAction} onPress={handlePlayPause}>
          <Ionicons name={status.playing ? 'pause-circle' : 'play-circle'} size={20} color={COLORS.primary} />
          <Text style={styles.footerActionText}>{formatDuration(entry.duration)}</Text>
        </TouchableOpacity>

        <View style={styles.footerRight}>
          {taskCount > 0 && (
            <View style={styles.taskCountBadge}>
              <Ionicons name="checkmark-done" size={13} color={COLORS.primary} />
              <Text style={styles.taskCountText}>
                {taskCount} tarefa{taskCount !== 1 ? 's' : ''}
              </Text>
            </View>
          )}
          {entry.edited && (
            <Text style={styles.editedBadge}>Editado</Text>
          )}
          <TouchableOpacity onPress={() => onEdit(entry)} style={styles.iconAction}>
            <Ionicons name="pencil-outline" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onDelete(entry)} style={styles.iconAction}>
            <Ionicons name="trash-outline" size={18} color={COLORS.error} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

export default function EntriesScreen() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [taskCounts, setTaskCounts] = useState<Map<string, number>>(new Map());
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [editText, setEditText] = useState('');

  const [categoryPickerEntry, setCategoryPickerEntry] = useState<Entry | null>(null);

  const [showFilterPanel, setShowFilterPanel] = useState(false);

  const [showTrash, setShowTrash] = useState(false);
  const [deletedEntries, setDeletedEntries] = useState<Entry[]>([]);
  const [loadingTrash, setLoadingTrash] = useState(false);

  const loadEntries = useCallback(async () => {
    if (!user) return;
    const [data, cats, tasks] = await Promise.all([
      getEntries(user.id),
      getCategories(user.id),
      getTasks(user.id),
    ]);
    setEntries(data);
    setCategories(cats);

    const counts = new Map<string, number>();
    for (const task of tasks) {
      if (!task.entryId) continue;
      counts.set(task.entryId, (counts.get(task.entryId) ?? 0) + 1);
    }
    setTaskCounts(counts);

    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadEntries();
    }, [loadEntries])
  );

  const loadTrash = useCallback(async () => {
    if (!user) return;
    setLoadingTrash(true);
    const data = await getDeletedEntries(user.id);
    setDeletedEntries(data);
    setLoadingTrash(false);
  }, [user]);

  const openTrash = () => {
    setShowTrash(true);
    loadTrash();
  };

  const handleRestore = async (entry: Entry) => {
    if (!entry.id) return;
    await restoreEntry(entry.id);
    await Promise.all([loadTrash(), loadEntries()]);
  };

  const handlePermanentDelete = (entry: Entry) => {
    alert('Excluir Definitivamente', 'Esta nota e seu áudio serão apagados para sempre. Não é possível desfazer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir para sempre',
        style: 'destructive',
        onPress: async () => {
          await permanentlyDeleteEntry(entry);
          await loadTrash();
        },
      },
    ]);
  };

  const handleEmptyTrash = () => {
    if (deletedEntries.length === 0) return;
    alert(
      'Esvaziar Lixeira',
      `Todas as ${deletedEntries.length} nota${deletedEntries.length !== 1 ? 's' : ''} da lixeira e seus áudios serão apagados para sempre. Não é possível desfazer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir tudo',
          style: 'destructive',
          onPress: async () => {
            await permanentlyDeleteAllEntries(deletedEntries);
            await loadTrash();
          },
        },
      ]
    );
  };

  const dateFilterBoundary = (filter: DateFilter): Date | null => {
    const now = new Date();
    if (filter === 'today') return startOfDay(now);
    if (filter === 'week') return startOfWeek(now, { locale: ptBR });
    if (filter === 'month') return startOfMonth(now);
    return null;
  };

  const boundary = dateFilterBoundary(dateFilter);
  let filtered = entries;
  if (selectedCategoryId) {
    filtered = filtered.filter((e) => e.categoryId === selectedCategoryId);
  }
  if (boundary) {
    filtered = filtered.filter((e) => e.createdAt >= boundary);
  }
  if (search.trim()) {
    filtered = filtered.filter((e) => matchesSearch(e.text, search));
  }

  const handleDelete = (entry: Entry) => {
    alert('Mover para Lixeira', 'A nota vai para a lixeira e pode ser restaurada depois.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await deleteEntry(entry);
          await loadEntries();
        },
      },
    ]);
  };

  const handleEdit = (entry: Entry) => {
    setEditingEntry(entry);
    setEditText(entry.text);
  };

  const saveEdit = async () => {
    if (!editingEntry?.id || !editText.trim()) return;
    await updateEntryText(editingEntry.id, editText.trim());
    setEditingEntry(null);
    await loadEntries();
  };

  const handlePickCategory = async (category: Category) => {
    if (!categoryPickerEntry?.id) return;
    await updateEntryCategory(categoryPickerEntry.id, category);
    setCategoryPickerEntry(null);
    await loadEntries();
  };

  // Group entries by date
  const groupedEntries = filtered.reduce<{ [key: string]: Entry[] }>((groups, entry) => {
    const key = formatRelativeDate(entry.createdAt);
    if (!groups[key]) groups[key] = [];
    groups[key].push(entry);
    return groups;
  }, {});

  const sections = Object.entries(groupedEntries);
  const hasActiveDateFilter = dateFilter !== 'all';

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

      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Minhas Notas</Text>
          <Text style={styles.subtitle}>{entries.length} nota{entries.length !== 1 ? 's' : ''} registrada{entries.length !== 1 ? 's' : ''}</Text>
        </View>
        <TouchableOpacity style={styles.trashBtn} onPress={openTrash}>
          <Ionicons name="trash-bin-outline" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color={COLORS.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar nas transcrições..."
          placeholderTextColor={COLORS.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={() => setShowFilterPanel(true)}>
          <Ionicons
            name="options-outline"
            size={20}
            color={hasActiveDateFilter ? COLORS.primary : COLORS.textMuted}
          />
        </TouchableOpacity>
      </View>

      {/* Category Filter */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterListWrap}
        data={[{ id: null, name: 'Todas', color: COLORS.primary }, ...categories]}
        keyExtractor={(item) => item.id ?? 'all'}
        contentContainerStyle={styles.filterList}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.filterChip,
              selectedCategoryId === item.id && { backgroundColor: item.color + '25', borderColor: item.color },
            ]}
            onPress={() => setSelectedCategoryId(item.id as any)}
          >
            <Text style={[styles.filterChipText, selectedCategoryId === item.id && { color: item.color }]}>
              {item.name}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* Entries List */}
      {filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="document-text-outline" size={56} color={COLORS.textMuted} />
          <Text style={styles.emptyTitle}>Nenhuma nota encontrada</Text>
          <Text style={styles.emptySubtitle}>
            {search ? 'Tente outra busca' : 'Grave sua primeira nota na aba Gravar'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={sections}
          keyExtractor={([date]) => date}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadEntries(); }} tintColor={COLORS.primary} />
          }
          renderItem={({ item: [date, dayEntries] }) => (
            <View>
              <Text style={styles.dateHeader}>{date}</Text>
              {dayEntries.map((entry) => (
                <EntryCard
                  key={entry.id}
                  entry={entry}
                  taskCount={taskCounts.get(entry.id!) ?? 0}
                  onDelete={handleDelete}
                  onEdit={handleEdit}
                  onChangeCategory={setCategoryPickerEntry}
                />
              ))}
            </View>
          )}
        />
      )}

      {/* Edit Modal */}
      <Modal visible={!!editingEntry} transparent animationType="fade" onRequestClose={() => setEditingEntry(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Editar Transcrição</Text>
            <TextInput
              style={styles.modalInput}
              value={editText}
              onChangeText={setEditText}
              multiline
              autoFocus
              placeholderTextColor={COLORS.textMuted}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setEditingEntry(null)}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={saveEdit}>
                <Text style={styles.modalSaveText}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Category Picker Modal */}
      <Modal visible={!!categoryPickerEntry} transparent animationType="fade" onRequestClose={() => setCategoryPickerEntry(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Mudar Categoria</Text>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={styles.filterOptionRow}
                onPress={() => handlePickCategory(cat)}
              >
                <View style={[styles.catColorCircle, { backgroundColor: cat.color }]} />
                <Text style={styles.filterOptionText}>{cat.name}</Text>
                {categoryPickerEntry?.categoryId === cat.id && (
                  <Ionicons name="checkmark" size={18} color={COLORS.primary} style={{ marginLeft: 'auto' }} />
                )}
              </TouchableOpacity>
            ))}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setCategoryPickerEntry(null)}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Filter Panel Modal */}
      <Modal visible={showFilterPanel} transparent animationType="fade" onRequestClose={() => setShowFilterPanel(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Filtrar por período</Text>
            {([
              ['all', 'Todas as datas'],
              ['today', 'Hoje'],
              ['week', 'Esta semana'],
              ['month', 'Este mês'],
            ] as [DateFilter, string][]).map(([value, label]) => (
              <TouchableOpacity
                key={value}
                style={styles.filterOptionRow}
                onPress={() => setDateFilter(value)}
              >
                <Ionicons
                  name={dateFilter === value ? 'radio-button-on' : 'radio-button-off'}
                  size={20}
                  color={dateFilter === value ? COLORS.primary : COLORS.textMuted}
                />
                <Text style={styles.filterOptionText}>{label}</Text>
              </TouchableOpacity>
            ))}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={() => setShowFilterPanel(false)}>
                <Text style={styles.modalSaveText}>Aplicar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Trash Modal */}
      <Modal visible={showTrash} transparent animationType="slide" onRequestClose={() => setShowTrash(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, styles.trashCard]}>
            <View style={styles.trashHeader}>
              <Text style={styles.modalTitle}>Lixeira</Text>
              <View style={styles.trashHeaderActions}>
                {deletedEntries.length > 0 && (
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
            ) : deletedEntries.length === 0 ? (
              <Text style={styles.emptySubtitle}>Nenhuma nota na lixeira.</Text>
            ) : (
              <FlatList
                data={deletedEntries}
                keyExtractor={(item) => item.id!}
                style={{ flex: 1 }}
                renderItem={({ item }) => (
                  <TrashItem entry={item} onRestore={handleRestore} onDeleteForever={handlePermanentDelete} />
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
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.sm },
  title: { fontSize: 24, color: COLORS.text, ...FONT.bold },
  subtitle: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
  trashBtn: { padding: SPACING.sm, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgCard,
    marginHorizontal: SPACING.lg,
    marginVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchInput: { flex: 1, color: COLORS.text, paddingVertical: 12, fontSize: 15 },

  filterListWrap: { flexGrow: 0, flexShrink: 0, height: 56 },
  filterList: { paddingHorizontal: SPACING.lg, paddingRight: SPACING.xl, alignItems: 'center', gap: SPACING.sm },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bgCard,
  },
  filterChipText: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 18, ...FONT.medium },

  dateHeader: {
    fontSize: 12,
    color: COLORS.textMuted,
    letterSpacing: 1,
    ...FONT.semibold,
    textTransform: 'uppercase',
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.lg,
  },

  listContent: { paddingBottom: 100 },

  card: {
    backgroundColor: COLORS.bgCard,
    marginHorizontal: SPACING.lg,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.card,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.sm },
  categoryBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full, borderWidth: 1 },
  categoryDot: { width: 6, height: 6, borderRadius: 3 },
  categoryText: { fontSize: 12, ...FONT.semibold },
  timeText: { fontSize: 12, color: COLORS.textMuted },
  entryText: { fontSize: 15, color: COLORS.text, lineHeight: 22, marginBottom: 4 },
  expandText: { fontSize: 13, color: COLORS.primary, ...FONT.medium, marginBottom: SPACING.sm },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  footerAction: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  footerActionText: { fontSize: 13, color: COLORS.textMuted },
  footerRight: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  editedBadge: { fontSize: 10, color: COLORS.textMuted, backgroundColor: COLORS.bg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  taskCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary + '20',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  taskCountText: { fontSize: 11, color: COLORS.primary, ...FONT.semibold },
  iconAction: { padding: 4 },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.md },
  emptyTitle: { fontSize: 18, color: COLORS.text, ...FONT.semibold },
  emptySubtitle: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', paddingHorizontal: SPACING.xl },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: SPACING.lg },
  modalCard: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.border },
  modalTitle: { fontSize: 18, color: COLORS.text, ...FONT.bold, marginBottom: SPACING.md },
  modalInput: {
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    color: COLORS.text,
    fontSize: 15,
    minHeight: 120,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.lg },
  modalCancelBtn: { flex: 1, padding: 12, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  modalCancelText: { color: COLORS.textSecondary, ...FONT.medium },
  modalSaveBtn: { flex: 1, padding: 12, borderRadius: RADIUS.md, backgroundColor: COLORS.primary, alignItems: 'center' },
  modalSaveText: { color: '#fff', ...FONT.semibold },

  filterOptionRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: 10 },
  filterOptionText: { color: COLORS.text, fontSize: 15 },
  catColorCircle: { width: 14, height: 14, borderRadius: 7 },

  trashCard: { height: '65%' },
  trashHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.md },
  trashHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  emptyTrashText: { color: COLORS.error, fontSize: 13, ...FONT.semibold },
  trashItem: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm, paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  trashItemText: { color: COLORS.text, fontSize: 14 },
  trashItemDate: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
});
