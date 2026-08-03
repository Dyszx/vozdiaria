// Main Recording Screen — the heart of the app
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Animated,
  Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { alert } from '../../utils/alert';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import { useRecordingQueue, QueueItem } from '../../hooks/useRecordingQueue';
import { getCategories, Category } from '../../services/entries';
import { COLORS, SPACING, RADIUS, FONT, SHADOW } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { router, useFocusEffect } from 'expo-router';
import { formatDuration } from '../../services/reports';

export default function RecordScreen() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [statusMessage, setStatusMessage] = useState('Selecione uma categoria e comece a gravar');
  const [hasApiKey, setHasApiKey] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  const {
    isRecording,
    isPaused,
    duration,
    audioUri,
    isLoading,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    resetRecording,
  } = useAudioRecorder();

  const { queue, enqueue, retryItem, dismissItem } = useRecordingQueue();

  useEffect(() => {
    if (isRecording && !isPaused) {
      startPulseAnimation();
    } else {
      stopPulseAnimation();
    }
  }, [isRecording, isPaused]);

  const loadData = useCallback(async () => {
    const key = await AsyncStorage.getItem('groq_api_key');
    setHasApiKey(!!key);

    if (user) {
      const cats = await getCategories(user.id);
      setCategories(cats);
      // Mantém a categoria já escolhida ao voltar pra essa aba — só troca pra
      // primeira se ainda não tinha nenhuma selecionada ou se a escolhida sumiu
      // (ex: foi excluída enquanto o usuário estava em outra tela).
      setSelectedCategory((prev) => {
        if (prev && cats.some((c) => c.id === prev.id)) return prev;
        return cats[0] ?? null;
      });
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const stopPulseAnimation = () => {
    pulseAnim.stopAnimation();
    glowAnim.stopAnimation();
    Animated.timing(pulseAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    Animated.timing(glowAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
  };

  const handleRecordPress = async () => {
    // Enquanto grava (sem pausa), o botão principal fica sem função própria —
    // reaproveita ele como o "Finalizar", em vez de deixar um botão parado.
    if (isRecording && !isPaused) {
      await handleStop();
      return;
    }

    if (!hasApiKey) {
      alert(
        '🔑 Chave Groq Necessária',
        'Configure sua chave gratuita da Groq na aba Configurações para transcrever seus áudios.',
        [
          { text: 'Configurar Agora', onPress: () => router.push('/settings') },
          { text: 'Cancelar', style: 'cancel' },
        ]
      );
      return;
    }

    if (!selectedCategory) {
      alert('Categoria', 'Selecione uma categoria antes de gravar.');
      return;
    }

    if (!isRecording) {
      setStatusMessage('Gravando... fale agora!');
      await startRecording();
    } else if (isPaused) {
      setStatusMessage('Gravando... fale agora!');
      await resumeRecording();
    }
  };

  const handlePause = async () => {
    await pauseRecording();
    setStatusMessage('Pausado. Toque para continuar.');
  };

  const handleCancel = () => {
    alert('Cancelar Gravação', 'O áudio gravado até agora será descartado.', [
      { text: 'Continuar gravando', style: 'cancel' },
      {
        text: 'Descartar',
        style: 'destructive',
        onPress: async () => {
          await stopRecording();
          resetRecording();
          setStatusMessage('Selecione uma categoria e comece a gravar');
        },
      },
    ]);
  };

  const handleStop = async () => {
    setStatusMessage('Parando gravação...');
    const uri = await stopRecording();
    if (!uri || !user || !selectedCategory) return;

    enqueue({
      audioUri: uri,
      categoryId: selectedCategory.id!,
      categoryName: selectedCategory.name,
      categoryColor: selectedCategory.color,
      duration,
      createdAt: new Date(),
      userId: user.id,
    });

    resetRecording();
    setStatusMessage('Selecione uma categoria e comece a gravar');
  };

  const recordButtonColor = isRecording
    ? isPaused
      ? [COLORS.accentWarn, '#FF8C00']
      : [COLORS.accentDanger, '#CC0044']
    : [COLORS.primary, COLORS.primaryLight];

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#0F0F1A', '#1A1A2E']} style={StyleSheet.absoluteFill} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.appName}>🎙️ VozDiária</Text>
        <Text style={styles.greeting}>
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </Text>
      </View>

      {/* Category Selector */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>CATEGORIA</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoriesScroll}
          contentContainerStyle={{ paddingRight: SPACING.xl }}
        >
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.categoryChip,
                selectedCategory?.id === cat.id && {
                  backgroundColor: cat.color + '25',
                  borderColor: cat.color,
                },
              ]}
              onPress={() => setSelectedCategory(cat)}
            >
              <View style={[styles.categoryDot, { backgroundColor: cat.color }]} />
              <Text
                style={[
                  styles.categoryChipText,
                  selectedCategory?.id === cat.id && { color: cat.color },
                ]}
              >
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Recording Area */}
      <View style={styles.recordingArea}>
        {/* Duration Display */}
        <Text style={styles.duration}>
          {isRecording || audioUri ? formatDuration(duration) : '00:00'}
        </Text>

        {/* Status Message */}
        <Text style={styles.statusMessage}>{statusMessage}</Text>

        {/* Animated Glow Ring */}
        {isRecording && !isPaused && (
          <Animated.View
            style={[
              styles.glowRing,
              {
                opacity: glowAnim,
                transform: [{ scale: pulseAnim }],
              },
            ]}
          />
        )}

        {/* Main Record Button */}
        <TouchableOpacity
          onPress={handleRecordPress}
          disabled={isLoading}
          style={styles.recordButtonWrap}
          activeOpacity={0.85}
        >
          <Animated.View style={{ transform: [{ scale: isRecording && !isPaused ? pulseAnim : 1 }] }}>
            <LinearGradient
              colors={recordButtonColor as [string, string]}
              style={[styles.recordButton, isRecording && styles.recordButtonActive]}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" size="large" />
              ) : isRecording && !isPaused ? (
                <Ionicons name="checkmark" size={isRecording ? 32 : 48} color="#fff" />
              ) : isPaused ? (
                <Ionicons name="play" size={isRecording ? 32 : 48} color="#fff" />
              ) : (
                <Ionicons name="mic-outline" size={48} color="#fff" />
              )}
            </LinearGradient>
          </Animated.View>
        </TouchableOpacity>

        {/* Secondary Controls */}
        {isRecording && (
          <View style={styles.secondaryControls}>
            <TouchableOpacity style={styles.controlBtn} onPress={handleCancel}>
              <Ionicons name="trash-outline" size={36} color={COLORS.textMuted} />
              <Text style={styles.controlBtnText}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.controlBtn}
              onPress={isPaused ? resumeRecording : handlePause}
            >
              <Ionicons
                name={isPaused ? 'play-circle-outline' : 'pause-circle-outline'}
                size={40}
                color={COLORS.textSecondary}
              />
              <Text style={styles.controlBtnText}>{isPaused ? 'Retomar' : 'Pausar'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Fila de processamento (transcrição/salvamento rodando em segundo plano) */}
      {!isRecording && queue.length > 0 ? (
        <View style={styles.queuePanel}>
          {queue.map((item) => (
            <QueueRow key={item.id} item={item} onRetry={retryItem} onDismiss={dismissItem} />
          ))}
        </View>
      ) : (
        !isRecording && (
          <View style={styles.tipCard}>
            <Ionicons name="information-circle-outline" size={18} color={COLORS.primary} />
            <Text style={styles.tipText}>
              Fale naturalmente. O Whisper entende português com alta precisão.
            </Text>
          </View>
        )
      )}
    </SafeAreaView>
  );
}

interface QueueRowProps {
  item: QueueItem;
  onRetry: (id: string) => void;
  onDismiss: (id: string) => void;
}

function QueueRow({ item, onRetry, onDismiss }: QueueRowProps) {
  const statusLabel =
    item.status === 'transcribing'
      ? '🤖 Transcrevendo...'
      : item.status === 'saving'
      ? '💾 Salvando...'
      : item.status === 'done'
      ? '✅ Salvo!'
      : item.errorMessage ?? 'Erro ao processar';

  return (
    <View style={styles.queueRow}>
      {item.status === 'transcribing' || item.status === 'saving' ? (
        <ActivityIndicator color={COLORS.primary} size="small" />
      ) : item.status === 'done' ? (
        <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
      ) : (
        <Ionicons name="alert-circle" size={20} color={COLORS.error} />
      )}

      <View style={styles.queueRowBody}>
        <View style={styles.queueRowHeader}>
          <View style={[styles.categoryDot, { backgroundColor: item.categoryColor }]} />
          <Text style={styles.queueRowCategory}>{item.categoryName}</Text>
          <Text style={styles.queueRowDuration}>{formatDuration(item.duration)}</Text>
        </View>
        <Text
          style={[styles.queueRowStatus, item.status === 'error' && { color: COLORS.error }]}
          numberOfLines={2}
        >
          {statusLabel}
        </Text>
      </View>

      {item.status === 'error' && (
        <View style={styles.queueRowActions}>
          <TouchableOpacity onPress={() => onRetry(item.id)}>
            <Text style={styles.queueRetryText}>Tentar novamente</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onDismiss(item.id)} style={styles.iconAction}>
            <Ionicons name="close" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.sm },
  appName: { fontSize: 22, color: COLORS.text, ...FONT.bold },
  greeting: { fontSize: 13, color: COLORS.textMuted, marginTop: 2, textTransform: 'capitalize' },

  section: { paddingHorizontal: SPACING.lg, marginTop: SPACING.lg },
  sectionLabel: { fontSize: 11, color: COLORS.textMuted, letterSpacing: 1.5, ...FONT.semibold, marginBottom: SPACING.sm },

  categoriesScroll: { marginHorizontal: -SPACING.lg, paddingHorizontal: SPACING.lg },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bgCard,
    marginRight: SPACING.sm,
    gap: 6,
  },
  categoryDot: { width: 8, height: 8, borderRadius: 4 },
  categoryChipText: { color: COLORS.textSecondary, fontSize: 14, ...FONT.medium },

  recordingArea: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.lg },

  duration: { fontSize: 52, color: COLORS.text, ...FONT.heavy, letterSpacing: -2, fontVariant: ['tabular-nums'] },
  statusMessage: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', paddingHorizontal: SPACING.xl },

  glowRing: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 2,
    borderColor: COLORS.accentDanger,
    backgroundColor: 'transparent',
  },

  recordButtonWrap: { position: 'relative' },
  recordButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW.glow,
  },
  recordButtonActive: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },

  secondaryControls: {
    flexDirection: 'row',
    gap: SPACING.xxl,
    marginTop: SPACING.md,
  },
  controlBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  controlBtnText: { fontSize: 13, color: COLORS.textSecondary, ...FONT.medium },

  tipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tipText: { flex: 1, fontSize: 13, color: COLORS.textMuted, lineHeight: 18 },

  queuePanel: { marginHorizontal: SPACING.lg, marginBottom: SPACING.lg, gap: SPACING.sm },
  queueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  queueRowBody: { flex: 1 },
  queueRowHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  queueRowCategory: { color: COLORS.text, fontSize: 13, ...FONT.semibold },
  queueRowDuration: { color: COLORS.textMuted, fontSize: 12, marginLeft: 'auto' },
  queueRowStatus: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
  queueRowActions: { alignItems: 'flex-end', gap: 4 },
  queueRetryText: { color: COLORS.primary, fontSize: 12, ...FONT.semibold },
  iconAction: { padding: 4 },
});
