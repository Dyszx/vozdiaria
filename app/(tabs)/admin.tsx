// Admin Screen — approve or revoke access for other accounts (admin-only, enforced by RLS)
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useFocusEffect } from 'expo-router';
import { alert } from '../../utils/alert';
import { getAllProfiles, setApproval, rejectProfile, Profile } from '../../services/profiles';
import { COLORS, SPACING, RADIUS, FONT } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';

interface ProfileRowProps {
  profile: Profile;
  onApprove: (profile: Profile) => void;
  onRevoke: (profile: Profile) => void;
  onReject: (profile: Profile) => void;
}

function ProfileRow({ profile, onApprove, onRevoke, onReject }: ProfileRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.rowBody}>
        <Text style={styles.rowEmail}>{profile.email ?? profile.id}</Text>
        <Text style={styles.rowDate}>
          Criada em {format(profile.createdAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
        </Text>
      </View>
      {profile.isAdmin ? (
        <Text style={styles.adminBadge}>Admin</Text>
      ) : profile.approved ? (
        <TouchableOpacity style={[styles.actionBtn, styles.actionBtnDanger]} onPress={() => onRevoke(profile)}>
          <Text style={[styles.actionBtnText, styles.actionBtnDangerText]}>Revogar</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.rowActions}>
          <TouchableOpacity style={[styles.actionBtn, styles.actionBtnDanger]} onPress={() => onReject(profile)}>
            <Text style={[styles.actionBtnText, styles.actionBtnDangerText]}>Recusar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => onApprove(profile)}>
            <Text style={styles.actionBtnText}>Aprovar</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export default function AdminScreen() {
  const { isAdmin } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProfiles = useCallback(async () => {
    if (!isAdmin) return;
    const data = await getAllProfiles();
    setProfiles(data);
    setLoading(false);
  }, [isAdmin]);

  useFocusEffect(
    useCallback(() => {
      loadProfiles();
    }, [loadProfiles])
  );

  // Defesa extra: a aba já fica escondida pra quem não é admin, isso cobre acesso direto pela URL.
  if (!isAdmin) return null;

  const handleApprove = (profile: Profile) => {
    alert('Aprovar Conta', `Liberar o acesso de "${profile.email}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Aprovar',
        onPress: async () => {
          await setApproval(profile.id, true);
          await loadProfiles();
        },
      },
    ]);
  };

  const handleRevoke = (profile: Profile) => {
    alert(
      'Revogar Acesso',
      `Bloquear o acesso de "${profile.email}"? A conta continua existindo, só perde acesso ao app.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Revogar',
          style: 'destructive',
          onPress: async () => {
            await setApproval(profile.id, false);
            await loadProfiles();
          },
        },
      ]
    );
  };

  const handleReject = (profile: Profile) => {
    alert(
      'Recusar Cadastro',
      `Recusar "${profile.email}"? A pessoa não vai conseguir entrar no app.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Recusar',
          style: 'destructive',
          onPress: async () => {
            await rejectProfile(profile.id);
            await loadProfiles();
          },
        },
      ]
    );
  };

  const pending = profiles.filter((p) => !p.approved);
  const approvedList = profiles.filter((p) => p.approved);

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

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Admin</Text>
          <Text style={styles.subtitle}>Aprove ou revogue o acesso de contas ao app</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⏳ PENDENTES ({pending.length})</Text>
          <View style={styles.card}>
            {pending.length === 0 ? (
              <Text style={styles.emptyText}>Nenhuma conta esperando aprovação.</Text>
            ) : (
              pending.map((p) => (
                <ProfileRow
                  key={p.id}
                  profile={p}
                  onApprove={handleApprove}
                  onRevoke={handleRevoke}
                  onReject={handleReject}
                />
              ))
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>✅ APROVADOS ({approvedList.length})</Text>
          <View style={styles.card}>
            {approvedList.length === 0 ? (
              <Text style={styles.emptyText}>Nenhuma conta aprovada ainda.</Text>
            ) : (
              approvedList.map((p) => (
                <ProfileRow
                  key={p.id}
                  profile={p}
                  onApprove={handleApprove}
                  onRevoke={handleRevoke}
                  onReject={handleReject}
                />
              ))
            )}
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.sm },
  title: { fontSize: 24, color: COLORS.text, ...FONT.bold },
  subtitle: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },

  section: { paddingHorizontal: SPACING.lg, marginTop: SPACING.lg },
  sectionTitle: { fontSize: 11, color: COLORS.textMuted, letterSpacing: 1.5, ...FONT.semibold, marginBottom: SPACING.sm },

  card: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border, gap: SPACING.sm },
  emptyText: { color: COLORS.textMuted, fontSize: 14 },

  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.xs },
  rowBody: { flex: 1 },
  rowEmail: { color: COLORS.text, fontSize: 15, ...FONT.medium },
  rowDate: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },

  adminBadge: {
    fontSize: 11,
    color: COLORS.primary,
    ...FONT.semibold,
    backgroundColor: COLORS.primary + '20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  rowActions: { flexDirection: 'row', gap: SPACING.sm },
  actionBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
  },
  actionBtnText: { color: '#fff', fontSize: 13, ...FONT.semibold },
  actionBtnDanger: { backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.error },
  actionBtnDangerText: { color: COLORS.error },
});
