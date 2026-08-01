// Reports Service — Generate daily, weekly, monthly and all-time reports
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Entry } from './entries';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export type ReportType = 'daily' | 'weekly' | 'monthly' | 'all';

export interface CategorySummary {
  name: string;
  color: string;
  count: number;
  duration: number;
}

export interface DailyReport {
  date: Date;
  entries: Entry[];
  totalDuration: number;
  categorySummary: CategorySummary[];
}

export interface WeeklyReport {
  weekStart: Date;
  weekEnd: Date;
  days: DailyReport[];
  totalEntries: number;
  totalDuration: number;
}

export interface MonthlyReport {
  monthStart: Date;
  monthEnd: Date;
  days: DailyReport[];
  totalEntries: number;
  totalDuration: number;
}

export interface AllTimeReport {
  entries: Entry[];
  totalDuration: number;
  categorySummary: CategorySummary[];
}

// Format seconds to readable string
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return `${hours}h ${remainMins}m`;
}

function summarizeByCategory(entries: Entry[]): CategorySummary[] {
  const categoryMap = new Map<string, CategorySummary>();
  for (const entry of entries) {
    const existing = categoryMap.get(entry.categoryId);
    if (existing) {
      existing.count++;
      existing.duration += entry.duration;
    } else {
      categoryMap.set(entry.categoryId, {
        name: entry.categoryName,
        color: entry.categoryColor,
        count: 1,
        duration: entry.duration,
      });
    }
  }
  return Array.from(categoryMap.values());
}

// Generate daily report
export function generateDailyReport(entries: Entry[], date: Date): DailyReport {
  const start = startOfDay(date);
  const end = endOfDay(date);
  const dayEntries = entries.filter(
    (e) => e.createdAt >= start && e.createdAt <= end
  );

  return {
    date,
    entries: dayEntries,
    totalDuration: dayEntries.reduce((sum, e) => sum + e.duration, 0),
    categorySummary: summarizeByCategory(dayEntries),
  };
}

// Generate weekly report
export function generateWeeklyReport(entries: Entry[], referenceDate: Date): WeeklyReport {
  const weekStart = startOfWeek(referenceDate, { locale: ptBR });
  const weekEnd = endOfWeek(referenceDate, { locale: ptBR });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const dailyReports = days.map((day) => generateDailyReport(entries, day));

  return {
    weekStart,
    weekEnd,
    days: dailyReports,
    totalEntries: dailyReports.reduce((sum, d) => sum + d.entries.length, 0),
    totalDuration: dailyReports.reduce((sum, d) => sum + d.totalDuration, 0),
  };
}

// Generate monthly report
export function generateMonthlyReport(entries: Entry[], referenceDate: Date): MonthlyReport {
  const monthStart = startOfMonth(referenceDate);
  const monthEnd = endOfMonth(referenceDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const dailyReports = days.map((day) => generateDailyReport(entries, day));

  return {
    monthStart,
    monthEnd,
    days: dailyReports,
    totalEntries: dailyReports.reduce((sum, d) => sum + d.entries.length, 0),
    totalDuration: dailyReports.reduce((sum, d) => sum + d.totalDuration, 0),
  };
}

// Generate a report across every entry, regardless of date
export function generateAllTimeReport(entries: Entry[]): AllTimeReport {
  const sorted = [...entries].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return {
    entries: sorted,
    totalDuration: sorted.reduce((sum, e) => sum + e.duration, 0),
    categorySummary: summarizeByCategory(sorted),
  };
}

type AnyReport = DailyReport | WeeklyReport | MonthlyReport | AllTimeReport;

// Generate HTML for PDF export
function generateReportHTML(report: AnyReport, type: ReportType): string {
  const isFlat = type === 'daily' || type === 'all';

  const title =
    type === 'daily'
      ? `Relatório - ${format((report as DailyReport).date, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`
      : type === 'weekly'
      ? `Relatório Semanal - ${format((report as WeeklyReport).weekStart, 'dd/MM', { locale: ptBR })} a ${format((report as WeeklyReport).weekEnd, 'dd/MM/yyyy', { locale: ptBR })}`
      : type === 'monthly'
      ? `Relatório Mensal - ${format((report as MonthlyReport).monthStart, "MMMM 'de' yyyy", { locale: ptBR })}`
      : 'Relatório Completo - Todas as Notas';

  const totalDuration = isFlat
    ? (report as DailyReport | AllTimeReport).totalDuration
    : (report as WeeklyReport | MonthlyReport).totalDuration;
  const totalEntries = isFlat
    ? (report as DailyReport | AllTimeReport).entries.length
    : (report as WeeklyReport | MonthlyReport).totalEntries;

  let entriesHTML = '';

  if (isFlat) {
    const flatEntries = (report as DailyReport | AllTimeReport).entries;
    entriesHTML = flatEntries.map((entry) => `
      <div class="entry">
        <div class="entry-header">
          <span class="category-badge" style="background-color: ${entry.categoryColor}20; color: ${entry.categoryColor}; border: 1px solid ${entry.categoryColor}50">
            ${entry.categoryName}
          </span>
          <span class="entry-time">${format(entry.createdAt, type === 'all' ? "dd/MM/yyyy HH:mm" : 'HH:mm')}</span>
          <span class="entry-duration">${formatDuration(entry.duration)}</span>
        </div>
        <p class="entry-text">${entry.text}</p>
      </div>
    `).join('');
  } else {
    const days = (report as WeeklyReport | MonthlyReport).days;
    entriesHTML = days
      .filter((d) => d.entries.length > 0)
      .map((day) => `
        <div class="day-section">
          <h3 class="day-title">${format(day.date, "EEEE, dd/MM", { locale: ptBR })}</h3>
          <p class="day-summary">${day.entries.length} nota${day.entries.length !== 1 ? 's' : ''} · ${formatDuration(day.totalDuration)}</p>
          ${day.entries.map((entry) => `
            <div class="entry">
              <div class="entry-header">
                <span class="category-badge" style="background-color: ${entry.categoryColor}20; color: ${entry.categoryColor}; border: 1px solid ${entry.categoryColor}50">
                  ${entry.categoryName}
                </span>
                <span class="entry-time">${format(entry.createdAt, 'HH:mm')}</span>
              </div>
              <p class="entry-text">${entry.text}</p>
            </div>
          `).join('')}
        </div>
      `).join('');
  }

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', sans-serif; background: #fff; color: #1a1a2e; padding: 40px; }
        .header { border-bottom: 3px solid #6C63FF; padding-bottom: 20px; margin-bottom: 30px; }
        .app-name { font-size: 14px; color: #6C63FF; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 8px; }
        h1 { font-size: 24px; font-weight: 700; color: #1a1a2e; }
        .stats { display: flex; gap: 30px; margin-top: 20px; }
        .stat { text-align: center; }
        .stat-value { font-size: 28px; font-weight: 700; color: #6C63FF; }
        .stat-label { font-size: 12px; color: #666; margin-top: 4px; }
        .entry { background: #f8f8ff; border-left: 3px solid #6C63FF; padding: 16px; margin-bottom: 12px; border-radius: 0 8px 8px 0; }
        .entry-header { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; flex-wrap: wrap; }
        .category-badge { padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; }
        .entry-time { font-size: 12px; color: #888; margin-left: auto; }
        .entry-duration { font-size: 12px; color: #aaa; }
        .entry-text { font-size: 15px; line-height: 1.6; color: #333; }
        .day-section { margin-bottom: 30px; }
        .day-title { font-size: 18px; font-weight: 700; color: #1a1a2e; margin-bottom: 4px; text-transform: capitalize; }
        .day-summary { font-size: 13px; color: #888; margin-bottom: 12px; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #aaa; text-align: center; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="app-name">🎙️ VozDiária</div>
        <h1>${title}</h1>
        <div class="stats">
          <div class="stat">
            <div class="stat-value">${totalEntries}</div>
            <div class="stat-label">Notas gravadas</div>
          </div>
          <div class="stat">
            <div class="stat-value">${formatDuration(totalDuration)}</div>
            <div class="stat-label">Tempo total</div>
          </div>
        </div>
      </div>
      ${entriesHTML || '<p style="color: #999; text-align: center; margin-top: 40px;">Nenhuma nota registrada neste período.</p>'}
      <div class="footer">Gerado pelo VozDiária em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</div>
    </body>
    </html>
  `;
}

// Export report as PDF
export async function exportReportAsPDF(report: AnyReport, type: ReportType): Promise<void> {
  const html = generateReportHTML(report, type);
  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: 'Compartilhar Relatório',
  });
}
