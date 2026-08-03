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
import { transcribeAudio } from '../../services/transcription';
import { createEntry, getCategories, Category } from '../../services/entries';
import { extractTasks, createTasksForEntry } from '../../services/tasks';
import { COLORS, SPACING, RADIUS, FONT, SHADOW } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { router, useFocusEffect } from 'expo-router';
import { formatDuration } from '../../services/reports';

export default function RecordScreen() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
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

  useEffect(() => {
    if (isRecording && !isPaused) {
      startPulseAnimation();
    } else {
      stopPulseAnimation();
    }
  }, [isRecording, isPaused]);

  const loadData = useCallback(async () => {
    const key = await AsyncStorage.getItem('gemini_api_key');
    setHasApiKey(!!key);

    if (user) {
      const cats = await getCategories(user.id);
      setCategories(cats);
      if (cats.length > 0) setSelectedCategory(cats[0]);
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
    if (!hasApiKey) {
      alert(
        '🔑 Chave Gemini Necessária',
        'Configure sua chave gratuita da Gemini API na aba Configurações para transcrever seus áudios.',
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

  const handleStop = async () => {
    setStatusMessage('Parando gravação...');
    const uri = await stopRecording();
    if (!uri || !user || !selectedCategory) return;

    setIsTranscribing(true);
    setStatusMessage('🤖 Transcrevendo seu áudio...');

    try {
      const text = await transcribeAudio(uri);
      setStatusMessage('💾 Salvando nota...');

      const entryId = await createEntry(
        {
          text,
          audioUrl: '',
          categoryId: selectedCategory.id!,
          categoryName: selectedCategory.name,
          categoryColor: selectedCategory.color,
          createdAt: new Date(),
          duration,
          edited: false,
          userId: user.id,
          deletedAt: null,
        },
        uri
      );

      try {
        const foundTasks = await extractTasks(text, new Date());
        if (foundTasks.length > 0) {
          await createTasksForEntry(foundTasks, entryId, user.id);
        }
      } catch (taskError) {
        // Extração de tarefas é um extra sobre a nota — uma falha aqui nunca deve impedir o salvamento dela.
        console.error('Task extraction error:', taskError);
      }

      setStatusMessage('✅ Nota salva com sucesso!');
      resetRecording();

      setTimeout(() => {
        setStatusMessage('Selecione uma categoria e comece a gravar');
      }, 3000);
    } catch (error: any) {
      console.error('Transcription/save error:', error);
      if (error.message === 'GEMINI_KEY_MISSING') {
        alert('Erro', 'Chave Gemini não configurada. Vá em Configurações.');
      } else {
        alert('Erro na Transcrição', String(error?.message ?? error));
      }
      setStatusMessage('Selecione uma categoria e comece a gravar');
    } finally {
      setIsTranscribing(false);
    }
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
          disabled={isLoading || isTranscribing}
          style={styles.recordButtonWrap}
          activeOpacity={0.85}
        >
          <Animated.View style={{ transform: [{ scale: isRecording && !isPaused ? pulseAnim : 1 }] }}>
            <LinearGradient
              colors={recordButtonColor as [string, string]}
              style={[styles.recordButton, isRecording && styles.recordButtonActive]}
            >
              {isLoading || isTranscribing ? (
                <ActivityIndicator color="#fff" size="large" />
              ) : isRecording && !isPaused ? (
                <Ionicons name="mic" size={isRecording ? 32 : 48} color="#fff" />
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

            <TouchableOpacity style={styles.controlBtn} onPress={handleStop}>
              <Ionicons name="stop-circle-outline" size={40} color={COLORS.accentDanger} />
              <Text style={[styles.controlBtnText, { color: COLORS.accentDanger }]}>Finalizar</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Quick Tip */}
      {!isRecording && !isTranscribing && (
        <View style={styles.tipCard}>
          <Ionicons name="information-circle-outline" size={18} color={COLORS.primary} />
          <Text style={styles.tipText}>
            Fale naturalmente. O Whisper entende português com alta precisão.
          </Text>
        </View>
      )}
    </SafeAreaView>
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
});
