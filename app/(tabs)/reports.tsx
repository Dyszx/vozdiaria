// Reports Screen — daily, weekly, monthly and all-time reports with PDF export
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { format, addDays, subDays, startOfWeek, endOfWeek, addWeeks, subWeeks, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getEntries, getCategories, Entry, Category } from '../../services/entries';
import {
  generateDailyReport,
  generateWeeklyReport,
  generateMonthlyReport,
  generateAllTimeReport,
  exportReportAsPDF,
  formatDuration,
  DailyReport,
  WeeklyReport,
  MonthlyReport,
  AllTimeReport,
  ReportType,
} from '../../services/reports';
import { COLORS, SPACING, RADIUS, FONT, SHADOW } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { useFocusEffect } from 'expo-router';

const REPORT_TYPES: { value: ReportType; label: string }[] = [
  { value: 'daily', label: 'Diário' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'monthly', label: 'Mensal' },
  { value: 'all', label: 'Todos' },
];

function TimelineEntry({ entry, showDate }: { entry: Entry; showDate: boolean }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.timelineCard}>
      <View style={[styles.timelineCatBadge, { backgroundColor: entry.categoryColor + '20', borderColor: entry.categoryColor + '50' }]}>
        <Text style={[styles.timelineCatText, { color: entry.categoryColor }]}>{entry.categoryName}</Text>
      </View>
      <TouchableOpacity activeOpacity={0.7} onPress={() => setExpanded((v) => !v)}>
        <Text style={styles.timelineText} numberOfLines={expanded ? undefined : 3}>
          {entry.text}
        </Text>
        <Text style={styles.expandText}>{expanded ? 'Ver menos' : 'Ver mais'}</Text>
      </TouchableOpacity>
      <Text style={styles.timelineDuration}>
        {showDate ? `${format(entry.createdAt, "dd/MM 'às' HH:mm")} · ` : ''}
        {formatDuration(entry.duration)}
      </Text>
    </View>
  );
}

export default function ReportsScreen() {
  const { user } = useAuth();
  const [reportType, setReportType] = useState<ReportType>('daily');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [dailyReport, setDailyReport] = useState<DailyReport | null>(null);
  const [weeklyReport, setWeeklyReport] = useState<WeeklyReport | null>(null);
  const [monthlyReport, setMonthlyReport] = useState<MonthlyReport | null>(null);
  const [allTimeReport, setAllTimeReport] = useState<AllTimeReport | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  const loadReport = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [allEntries, cats] = await Promise.all([getEntries(user.id), getCategories(user.id)]);
      setCategories(cats);
      const entries = selectedCategoryId
        ? allEntries.filter((e) => e.categoryId === selectedCategoryId)
        : allEntries;

      if (reportType === 'daily') {
        setDailyReport(generateDailyReport(entries, currentDate));
      } else if (reportType === 'weekly') {
        setWeeklyReport(generateWeeklyReport(entries, currentDate));
      } else if (reportType === 'monthly') {
        setMonthlyReport(generateMonthlyReport(entries, currentDate));
      } else {
        setAllTimeReport(generateAllTimeReport(entries));
      }
    } finally {
      setLoading(false);
    }
  }, [user, reportType, currentDate, selectedCategoryId]);

  useFocusEffect(
    useCallback(() => {
      loadReport();
    }, [loadReport])
  );

  const navigateDate = (direction: 1 | -1) => {
    if (reportType === 'daily') {
      setCurrentDate((d) => direction === 1 ? addDays(d, 1) : subDays(d, 1));
    } else if (reportType === 'weekly') {
      setCurrentDate((d) => direction === 1 ? addWeeks(d, 1) : subWeeks(d, 1));
    } else if (reportType === 'monthly') {
      setCurrentDate((d) => direction === 1 ? addMonths(d, 1) : subMonths(d, 1));
    }
  };

  const handleExport = async () => {
    const report = reportType === 'daily' ? dailyReport
      : reportType === 'weekly' ? weeklyReport
      : reportType === 'monthly' ? monthlyReport
      : allTimeReport;
    if (!report) return;
    setExporting(true);
    try {
      await exportReportAsPDF(report, reportType);
    } catch {
      Alert.alert('Erro', 'Não foi possível exportar o relatório.');
    } finally {
      setExporting(false);
    }
  };

  const isToday = format(currentDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
  const isThisWeek = format(startOfWeek(currentDate, { locale: ptBR }), 'yyyy-MM-dd') === format(startOfWeek(new Date(), { locale: ptBR }), 'yyyy-MM-dd');
  const isThisMonth = format(currentDate, 'yyyy-MM') === format(new Date(), 'yyyy-MM');

  const periodLabel =
    reportType === 'daily' ? format(currentDate, "EEEE, dd 'de' MMMM", { locale: ptBR })
    : reportType === 'weekly' ? `${format(startOfWeek(currentDate, { locale: ptBR }), 'dd/MM', { locale: ptBR })} – ${format(endOfWeek(currentDate, { locale: ptBR }), 'dd/MM', { locale: ptBR })}`
    : reportType === 'monthly' ? format(currentDate, "MMMM 'de' yyyy", { locale: ptBR })
    : 'Todo o período';

  const canNavigateForward =
    reportType === 'daily' ? !isToday
    : reportType === 'weekly' ? !isThisWeek
    : reportType === 'monthly' ? !isThisMonth
    : false;

  const isFlat = reportType === 'daily' || reportType === 'all';
  const isRange = reportType === 'weekly' || reportType === 'monthly';

  const flatReport = reportType === 'daily' ? dailyReport : reportType === 'all' ? allTimeReport : null;
  const rangeReport = reportType === 'weekly' ? weeklyReport : reportType === 'monthly' ? monthlyReport : null;

  const totalEntries = isFlat ? (flatReport?.entries.length ?? 0) : (rangeReport?.totalEntries ?? 0);
  const totalDuration = isFlat ? (flatReport?.totalDuration ?? 0) : (rangeReport?.totalDuration ?? 0);
  const maxDayCount = rangeReport ? Math.max(...rangeReport.days.map((d) => d.entries.length), 1) : 1;

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#0F0F1A', '#1A1A2E']} style={StyleSheet.absoluteFill} />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Relatórios</Text>

          {/* Type Toggle */}
          <View style={styles.typeToggle}>
            {REPORT_TYPES.map((rt) => (
              <TouchableOpacity
                key={rt.value}
                style={[styles.toggleBtn, reportType === rt.value && styles.toggleBtnActive]}
                onPress={() => setReportType(rt.value)}
              >
                <Text style={[styles.toggleText, reportType === rt.value && styles.toggleTextActive]} numberOfLines={1}>{rt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
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

        {/* Period Navigator */}
        {reportType !== 'all' && (
          <View style={styles.navigator}>
            <TouchableOpacity style={styles.navBtn} onPress={() => navigateDate(-1)}>
              <Ionicons name="chevron-back" size={22} color={COLORS.text} />
            </TouchableOpacity>

            <Text style={styles.periodLabel}>{periodLabel}</Text>

            <TouchableOpacity
              style={[styles.navBtn, !canNavigateForward && styles.navBtnDisabled]}
              onPress={() => canNavigateForward && navigateDate(1)}
            >
              <Ionicons name="chevron-forward" size={22} color={canNavigateForward ? COLORS.text : COLORS.textMuted} />
            </TouchableOpacity>
          </View>
        )}
        {reportType === 'all' && (
          <Text style={[styles.periodLabel, { marginVertical: SPACING.md }]}>{periodLabel}</Text>
        )}

        {loading ? (
          <ActivityIndicator color={COLORS.primary} size="large" style={{ marginTop: 60 }} />
        ) : (
          <>
            {/* Stats Cards */}
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <LinearGradient colors={['#6C63FF', '#4F48CC']} style={styles.statGradient}>
                  <Ionicons name="mic" size={24} color="#fff" />
                  <Text style={styles.statValue}>{totalEntries}</Text>
                  <Text style={styles.statLabel}>Notas</Text>
                </LinearGradient>
              </View>

              <View style={styles.statCard}>
                <LinearGradient colors={['#43D9AD', '#2A9D8F']} style={styles.statGradient}>
                  <Ionicons name="time-outline" size={24} color="#fff" />
                  <Text style={styles.statValue}>{formatDuration(totalDuration)}</Text>
                  <Text style={styles.statLabel}>Tempo Total</Text>
                </LinearGradient>
              </View>
            </View>

            {/* Category Breakdown */}
            {isFlat && flatReport && flatReport.categorySummary.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Por Categoria</Text>
                {flatReport.categorySummary.map((cat, idx) => (
                  <View key={idx} style={styles.categoryRow}>
                    <View style={[styles.catColorBar, { backgroundColor: cat.color }]} />
                    <Text style={styles.catName}>{cat.name}</Text>
                    <Text style={styles.catCount}>{cat.count} nota{cat.count !== 1 ? 's' : ''}</Text>
                    <Text style={styles.catDuration}>{formatDuration(cat.duration)}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Timeline (daily / all) */}
            {isFlat && flatReport && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Linha do Tempo</Text>
                {flatReport.entries.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Ionicons name="calendar-outline" size={40} color={COLORS.textMuted} />
                    <Text style={styles.emptyText}>Nenhuma nota neste período</Text>
                  </View>
                ) : (
                  flatReport.entries.map((entry, idx) => (
                    <View key={entry.id} style={styles.timelineItem}>
                      <View style={styles.timelineLeft}>
                        <Text style={styles.timelineTime}>{format(entry.createdAt, 'HH:mm')}</Text>
                        {idx < flatReport.entries.length - 1 && <View style={styles.timelineLine} />}
                      </View>
                      <TimelineEntry entry={entry} showDate={reportType === 'all'} />
                    </View>
                  ))
                )}
              </View>
            )}

            {/* Day-by-day breakdown (weekly / monthly) */}
            {isRange && rangeReport && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Resumo por Dia</Text>
                {rangeReport.days.map((day, idx) => (
                  <View key={idx} style={styles.weekDayRow}>
                    <Text style={styles.weekDayName} numberOfLines={1}>
                      {format(day.date, reportType === 'monthly' ? 'dd' : 'EEE', { locale: ptBR })}
                    </Text>
                    <View style={styles.weekDayBar}>
                      <View
                        style={[
                          styles.weekDayFill,
                          { width: `${(day.entries.length / maxDayCount) * 100}%` },
                        ]}
                      />
                    </View>
                    <Text style={styles.weekDayCount}>{day.entries.length}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Export Button */}
            {totalEntries > 0 && (
              <TouchableOpacity
                style={styles.exportBtn}
                onPress={handleExport}
                disabled={exporting}
              >
                <LinearGradient colors={['#6C63FF', '#4F48CC']} style={styles.exportGradient}>
                  {exporting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="share-outline" size={20} color="#fff" />
                      <Text style={styles.exportText}>Exportar PDF</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            )}
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.sm },
  title: { fontSize: 24, color: COLORS.text, ...FONT.bold, marginBottom: SPACING.md },

  typeToggle: { flexDirection: 'row', backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, padding: 4, gap: 4, borderWidth: 1, borderColor: COLORS.border },
  toggleBtn: { flex: 1, alignItems: 'center', paddingHorizontal: 4, paddingVertical: SPACING.sm, borderRadius: RADIUS.sm },
  toggleBtnActive: { backgroundColor: COLORS.primary },
  toggleText: { fontSize: 13, color: COLORS.textSecondary, ...FONT.semibold },
  toggleTextActive: { color: '#fff' },

  filterListWrap: { flexGrow: 0, flexShrink: 0, height: 56, marginTop: SPACING.sm },
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

  navigator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, marginVertical: SPACING.md },
  navBtn: { padding: SPACING.sm, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border },
  navBtnDisabled: { opacity: 0.4 },
  periodLabel: { fontSize: 15, color: COLORS.text, ...FONT.semibold, textTransform: 'capitalize', textAlign: 'center', flex: 1, paddingHorizontal: SPACING.lg },

  statsRow: { flexDirection: 'row', paddingHorizontal: SPACING.lg, gap: SPACING.md, marginBottom: SPACING.md },
  statCard: { flex: 1, borderRadius: RADIUS.lg, overflow: 'hidden', ...SHADOW.card },
  statGradient: { padding: SPACING.md, alignItems: 'center', gap: 6 },
  statValue: { fontSize: 28, color: '#fff', ...FONT.heavy },
  statLabel: { fontSize: 12, color: 'rgba(255,255,255,0.8)', ...FONT.medium },

  section: { paddingHorizontal: SPACING.lg, marginBottom: SPACING.lg },
  sectionTitle: { fontSize: 14, color: COLORS.textMuted, ...FONT.semibold, letterSpacing: 1, textTransform: 'uppercase', marginBottom: SPACING.md },

  categoryRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm, gap: SPACING.sm, borderWidth: 1, borderColor: COLORS.border },
  catColorBar: { width: 4, height: 24, borderRadius: 2 },
  catName: { flex: 1, color: COLORS.text, ...FONT.medium, fontSize: 15 },
  catCount: { color: COLORS.textMuted, fontSize: 13 },
  catDuration: { color: COLORS.primary, fontSize: 13, ...FONT.semibold, minWidth: 40, textAlign: 'right' },

  timelineItem: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.sm },
  timelineLeft: { alignItems: 'center', width: 40 },
  timelineTime: { fontSize: 12, color: COLORS.textMuted, ...FONT.medium },
  timelineLine: { flex: 1, width: 1, backgroundColor: COLORS.border, marginTop: 6 },
  timelineCard: { flex: 1, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
  timelineCatBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full, borderWidth: 1, marginBottom: 8 },
  timelineCatText: { fontSize: 11, ...FONT.semibold },
  timelineText: { color: COLORS.text, fontSize: 14, lineHeight: 20, marginBottom: 4 },
  expandText: { fontSize: 12, color: COLORS.primary, ...FONT.medium, marginBottom: 6 },
  timelineDuration: { color: COLORS.textMuted, fontSize: 12 },

  weekDayRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: 10 },
  weekDayName: { width: 36, color: COLORS.textSecondary, fontSize: 13, ...FONT.medium, textTransform: 'capitalize' },
  weekDayBar: { flex: 1, height: 8, backgroundColor: COLORS.bgCard, borderRadius: 4, overflow: 'hidden' },
  weekDayFill: { height: '100%', backgroundColor: COLORS.primary, borderRadius: 4, minWidth: 4 },
  weekDayCount: { width: 24, color: COLORS.textMuted, fontSize: 13, textAlign: 'right' },

  emptyState: { alignItems: 'center', paddingVertical: SPACING.xxl, gap: SPACING.sm },
  emptyText: { color: COLORS.textMuted, fontSize: 15 },

  exportBtn: { marginHorizontal: SPACING.lg, borderRadius: RADIUS.lg, overflow: 'hidden', ...SHADOW.card },
  exportGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, padding: SPACING.md },
  exportText: { color: '#fff', fontSize: 16, ...FONT.semibold },
});
