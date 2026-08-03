// App Layout with auth gate and tab navigation
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { alert } from '../utils/alert';
import { isValidEmail } from '../utils/validation';
import { COLORS, SPACING, RADIUS, FONT } from '../constants/theme';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';

SplashScreen.preventAutoHideAsync();

function LoadingScreen() {
  return (
    <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
      <ActivityIndicator color={COLORS.primary} size="large" />
    </View>
  );
}

function AuthScreen() {
  const { signInWithEmailPassword, signUpWithEmailPassword } = useAuth();
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [signupDone, setSignupDone] = useState(false);

  const handleSubmit = async () => {
    if (!isValidEmail(email)) {
      alert('Erro', 'Digite um e-mail válido.');
      return;
    }
    if (password.length < 6) {
      alert('Erro', 'A senha precisa ter pelo menos 6 caracteres.');
      return;
    }
    if (mode === 'signUp' && password !== passwordConfirm) {
      alert('Erro', 'As senhas não são iguais.');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'signUp') {
        await signUpWithEmailPassword(email.trim(), password);
        setSignupDone(true);
        setMode('signIn');
        setPassword('');
        setPasswordConfirm('');
      } else {
        await signInWithEmailPassword(email.trim(), password);
      }
    } catch (error: any) {
      alert('Erro', error?.message ?? 'Não foi possível completar a operação.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#0F0F1A', '#1A1A2E']} style={StyleSheet.absoluteFill} />
      <View style={styles.authWrap}>
        <Text style={styles.authAppName}>🎙️ VozDiária</Text>
        <Text style={styles.authTitle}>{mode === 'signIn' ? 'Entre na sua conta' : 'Crie sua conta'}</Text>

        {signupDone && (
          <View style={styles.authNotice}>
            <Text style={styles.authNoticeText}>
              ✅ Verifique seu e-mail pra confirmar a conta. Depois, volte aqui e entre.
            </Text>
          </View>
        )}

        <TextInput
          style={styles.authInput}
          placeholder="seu@email.com"
          placeholderTextColor={COLORS.textMuted}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={styles.authInput}
          placeholder="Senha (mín. 6 caracteres)"
          placeholderTextColor={COLORS.textMuted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        {mode === 'signUp' && (
          <TextInput
            style={styles.authInput}
            placeholder="Confirmar senha"
            placeholderTextColor={COLORS.textMuted}
            value={passwordConfirm}
            onChangeText={setPasswordConfirm}
            secureTextEntry
          />
        )}

        <TouchableOpacity style={styles.authSubmitBtn} onPress={handleSubmit} disabled={submitting}>
          <Text style={styles.authSubmitText}>
            {submitting ? 'Aguarde...' : mode === 'signIn' ? 'Entrar' : 'Criar conta'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            setMode((m) => (m === 'signIn' ? 'signUp' : 'signIn'));
            setSignupDone(false);
          }}
        >
          <Text style={styles.authToggleText}>
            {mode === 'signIn' ? 'Não tem conta? Criar uma' : 'Já tem conta? Entrar'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function PendingApprovalScreen() {
  const { signOut } = useAuth();

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#0F0F1A', '#1A1A2E']} style={StyleSheet.absoluteFill} />
      <View style={styles.authWrap}>
        <Text style={styles.authAppName}>⏳ Aguardando aprovação</Text>
        <Text style={styles.authTitle}>
          Sua conta foi criada, mas ainda precisa ser liberada pelo administrador antes de usar o app.
        </Text>
        <TouchableOpacity style={styles.authSubmitBtn} onPress={signOut}>
          <Text style={styles.authSubmitText}>Sair</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function Gate({ children }: { children: React.ReactNode }) {
  const { user, loading, approved } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <AuthScreen />;
  if (!approved) return <PendingApprovalScreen />;
  return <>{children}</>;
}

export default function RootLayout() {
  const [loaded] = useFonts({
    // Using system fonts; can add custom fonts here
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) return null;

  return (
    <AuthProvider>
      <StatusBar style="light" />
      <Gate>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
        </Stack>
      </Gate>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  authWrap: { flex: 1, justifyContent: 'center', paddingHorizontal: SPACING.lg, gap: SPACING.sm },
  authAppName: { fontSize: 24, color: COLORS.text, ...FONT.bold, textAlign: 'center', marginBottom: SPACING.xs },
  authTitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  authNotice: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.md,
  },
  authNoticeText: { color: COLORS.accent, fontSize: 13, lineHeight: 18, textAlign: 'center' },
  authInput: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    color: COLORS.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.sm,
  },
  authSubmitBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    padding: 14,
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  authSubmitText: { color: '#fff', fontSize: 15, ...FONT.semibold },
  authToggleText: {
    color: COLORS.primary,
    fontSize: 13,
    ...FONT.medium,
    textAlign: 'center',
    marginTop: SPACING.md,
  },
});
