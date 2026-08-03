// Settings Screen — API keys, categories management, account
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { alert } from '../../utils/alert';
import { getCategories, addCategory, deleteCategory, Category } from '../../services/entries';
import { COLORS, SPACING, RADIUS, FONT } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { useFocusEffect } from 'expo-router';

const CATEGORY_COLORS = [
  '#6C63FF', '#FF6584', '#43D9AD', '#FFB347', '#78C1F3',
  '#F9CA24', '#6AB04C', '#E55039', '#8E44AD', '#1ABC9C',
];

export default function SettingsScreen() {
  const { user, signOut, linkEmailPassword, signInWithEmailPassword } = useAuth();
  const [geminiKey, setGeminiKey] = useState('');
  const [savedKey, setSavedKey] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState(CATEGORY_COLORS[0]);
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [showAddCat, setShowAddCat] = useState(false);

  const [showBackupForm, setShowBackupForm] = useState(false);
  const [backupEmail, setBackupEmail] = useState('');
  const [backupPassword, setBackupPassword] = useState('');
  const [backupPasswordConfirm, setBackupPasswordConfirm] = useState('');
  const [savingBackup, setSavingBackup] = useState(false);

  const [showSignInForm, setShowSignInForm] = useState(false);
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [signingIn, setSigningIn] = useState(false);

  const loadData = useCallback(async () => {
    const key = await AsyncStorage.getItem('gemini_api_key');
    if (key) {
      setSavedKey(key);
      setGeminiKey(key);
    }
    if (user) {
      const cats = await getCategories(user.id);
      setCategories(cats);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleSaveKey = async () => {
    if (!geminiKey.trim()) {
      alert('Erro', 'Digite uma chave válida.');
      return;
    }
    await AsyncStorage.setItem('gemini_api_key', geminiKey.trim());
    setSavedKey(geminiKey.trim());
    setShowKeyInput(false);
    alert('✅ Salvo', 'Chave Gemini configurada com sucesso!');
  };

  const handleAddCategory = async () => {
    if (!newCatName.trim() || !user) return;
    await addCategory({
      name: newCatName.trim(),
      color: newCatColor,
      icon: 'document-text',
      userId: user.id,
    });
    setNewCatName('');
    setShowAddCat(false);
    await loadData();
  };

  const handleDeleteCategory = (category: Category) => {
    alert(
      'Excluir Categoria',
      `Excluir "${category.name}"? As notas que já usam essa categoria não são apagadas, só deixam de ficar ligadas a ela.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            if (!category.id) return;
            await deleteCategory(category.id);
            await loadData();
          },
        },
      ]
    );
  };

  const maskKey = (key: string) => {
    if (!key) return '';
    return key.slice(0, 8) + '•'.repeat(20) + key.slice(-4);
  };

  const handleCreateBackup = async () => {
    if (!backupEmail.includes('@') || !backupEmail.includes('.')) {
      alert('Erro', 'Digite um e-mail válido.');
      return;
    }
    if (backupPassword.length < 6) {
      alert('Erro', 'A senha precisa ter pelo menos 6 caracteres.');
      return;
    }
    if (backupPassword !== backupPasswordConfirm) {
      alert('Erro', 'As senhas não são iguais.');
      return;
    }
    setSavingBackup(true);
    try {
      await linkEmailPassword(backupEmail.trim(), backupPassword);
      setShowBackupForm(false);
      setBackupPassword('');
      setBackupPasswordConfirm('');
      alert(
        '✅ Quase lá',
        'Enviamos um e-mail de confirmação para ' + backupEmail.trim() + '. Confirme para proteger sua conta.'
      );
    } catch (error: any) {
      alert('Erro', error.message ?? 'Não foi possível criar o backup.');
    } finally {
      setSavingBackup(false);
    }
  };

  const handleSignIn = async () => {
    if (!signInEmail.trim() || !signInPassword) {
      alert('Erro', 'Preencha e-mail e senha.');
      return;
    }
    setSigningIn(true);
    try {
      await signInWithEmailPassword(signInEmail.trim(), signInPassword);
      setShowSignInForm(false);
      setSignInPassword('');
      alert('✅ Pronto', 'Login feito com sucesso. Suas notas devem aparecer em instantes.');
    } catch (error: any) {
      alert('Erro', error.message ?? 'Não foi possível entrar.');
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#0F0F1A', '#1A1A2E']} style={StyleSheet.absoluteFill} />

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Configurações</Text>
        </View>

        {/* Account Backup Section */}
        {user?.is_anonymous !== false && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🔒 BACKUP DA CONTA</Text>
            <View style={styles.card}>
              <Text style={styles.cardDesc}>
                Sua conta hoje é <Text style={{ color: COLORS.accentWarn }}>anônima</Text>: se desinstalar o app, limpar
                os dados dele ou trocar de celular, você perde o acesso às suas notas (elas continuam salvas, mas
                ficam inacessíveis). Crie um e-mail e senha pra proteger isso, sem perder nada do que já tem.
              </Text>

              {!showBackupForm ? (
                <TouchableOpacity style={styles.configureBtn} onPress={() => setShowBackupForm(true)}>
                  <Ionicons name="shield-checkmark-outline" size={18} color="#fff" />
                  <Text style={styles.configureBtnText}>Criar Backup da Conta</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.addCatForm}>
                  <TextInput
                    style={styles.catInput}
                    placeholder="seu@email.com"
                    placeholderTextColor={COLORS.textMuted}
                    value={backupEmail}
                    onChangeText={setBackupEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                  <TextInput
                    style={styles.catInput}
                    placeholder="Senha (mín. 6 caracteres)"
                    placeholderTextColor={COLORS.textMuted}
                    value={backupPassword}
                    onChangeText={setBackupPassword}
                    secureTextEntry
                  />
                  <TextInput
                    style={styles.catInput}
                    placeholder="Confirmar senha"
                    placeholderTextColor={COLORS.textMuted}
                    value={backupPasswordConfirm}
                    onChangeText={setBackupPasswordConfirm}
                    secureTextEntry
                  />
                  <View style={styles.addCatActions}>
                    <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowBackupForm(false)}>
                      <Text style={styles.cancelBtnText}>Cancelar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.addBtn} onPress={handleCreateBackup} disabled={savingBackup}>
                      <Text style={styles.addBtnText}>{savingBackup ? 'Salvando...' : 'Salvar'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {!showSignInForm ? (
                <TouchableOpacity onPress={() => setShowSignInForm(true)}>
                  <Text style={styles.linkText}>Já tenho uma conta, entrar →</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.addCatForm}>
                  <TextInput
                    style={styles.catInput}
                    placeholder="seu@email.com"
                    placeholderTextColor={COLORS.textMuted}
                    value={signInEmail}
                    onChangeText={setSignInEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                  <TextInput
                    style={styles.catInput}
                    placeholder="Senha"
                    placeholderTextColor={COLORS.textMuted}
                    value={signInPassword}
                    onChangeText={setSignInPassword}
                    secureTextEntry
                  />
                  <View style={styles.addCatActions}>
                    <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowSignInForm(false)}>
                      <Text style={styles.cancelBtnText}>Cancelar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.addBtn} onPress={handleSignIn} disabled={signingIn}>
                      <Text style={styles.addBtnText}>{signingIn ? 'Entrando...' : 'Entrar'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>CONTA</Text>
          <View style={styles.card}>
            <View style={styles.accountRow}>
              <View style={styles.avatar}>
                <Ionicons name="person" size={24} color={COLORS.primary} />
              </View>
              <View style={styles.accountInfo}>
                <Text style={styles.accountName}>{user?.user_metadata?.full_name ?? 'Usuário'}</Text>
                <Text style={styles.accountEmail}>{user?.email ?? 'Não conectado'}</Text>
              </View>
              <TouchableOpacity onPress={signOut}>
                <Ionicons name="log-out-outline" size={22} color={COLORS.error} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Gemini API Key Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔑 CHAVE GEMINI (TRANSCRIÇÃO)</Text>
          <View style={styles.card}>
            <Text style={styles.cardDesc}>
              O Google Gemini transcreve seu áudio <Text style={{ color: COLORS.accent }}>gratuitamente</Text> dentro dos limites diários do plano gratuito.
            </Text>

            <TouchableOpacity
              style={styles.linkBtn}
              onPress={() => alert('Obter Chave Gemini', 'Acesse aistudio.google.com/apikey no seu navegador, faça login com sua conta Google e gere uma API Key.')}
            >
              <Ionicons name="open-outline" size={16} color={COLORS.primary} />
              <Text style={styles.linkText}>Como obter a chave gratuita →</Text>
            </TouchableOpacity>

            {savedKey ? (
              <View style={styles.savedKeyRow}>
                <Ionicons name="checkmark-circle" size={18} color={COLORS.success} />
                <Text style={styles.savedKeyText} numberOfLines={1}>{maskKey(savedKey)}</Text>
                <TouchableOpacity onPress={() => setShowKeyInput(!showKeyInput)}>
                  <Text style={{ color: COLORS.primary, fontSize: 13 }}>Alterar</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.configureBtn}
                onPress={() => setShowKeyInput(true)}
              >
                <Ionicons name="key-outline" size={18} color="#fff" />
                <Text style={styles.configureBtnText}>Configurar Chave</Text>
              </TouchableOpacity>
            )}

            {showKeyInput && (
              <View style={styles.keyInputWrap}>
                <TextInput
                  style={styles.keyInput}
                  placeholder="AIza..."
                  placeholderTextColor={COLORS.textMuted}
                  value={geminiKey}
                  onChangeText={setGeminiKey}
                  secureTextEntry
                  autoCapitalize="none"
                />
                <TouchableOpacity style={styles.saveKeyBtn} onPress={handleSaveKey}>
                  <Text style={styles.saveKeyText}>Salvar</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* Categories Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📂 CATEGORIAS</Text>
          <View style={styles.card}>
            {categories.map((cat) => (
              <View key={cat.id} style={styles.catRow}>
                <View style={[styles.catColorCircle, { backgroundColor: cat.color }]} />
                <Text style={styles.catName}>{cat.name}</Text>
                <TouchableOpacity onPress={() => handleDeleteCategory(cat)} style={styles.catDeleteBtn}>
                  <Ionicons name="trash-outline" size={16} color={COLORS.error} />
                </TouchableOpacity>
              </View>
            ))}

            {showAddCat ? (
              <View style={styles.addCatForm}>
                <TextInput
                  style={styles.catInput}
                  placeholder="Nome da categoria..."
                  placeholderTextColor={COLORS.textMuted}
                  value={newCatName}
                  onChangeText={setNewCatName}
                />
                <View style={styles.colorPicker}>
                  {CATEGORY_COLORS.map((color) => (
                    <TouchableOpacity
                      key={color}
                      style={[styles.colorOption, { backgroundColor: color }, newCatColor === color && styles.colorOptionSelected]}
                      onPress={() => setNewCatColor(color)}
                    />
                  ))}
                </View>
                <View style={styles.addCatActions}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAddCat(false)}>
                    <Text style={styles.cancelBtnText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.addBtn} onPress={handleAddCategory}>
                    <Text style={styles.addBtnText}>Adicionar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity style={styles.addCatBtn} onPress={() => setShowAddCat(true)}>
                <Ionicons name="add-circle-outline" size={20} color={COLORS.primary} />
                <Text style={styles.addCatBtnText}>Nova Categoria</Text>
              </TouchableOpacity>
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

  section: { paddingHorizontal: SPACING.lg, marginTop: SPACING.lg },
  sectionTitle: { fontSize: 11, color: COLORS.textMuted, letterSpacing: 1.5, ...FONT.semibold, marginBottom: SPACING.sm },

  card: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border, gap: SPACING.md },

  accountRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.primary + '20', alignItems: 'center', justifyContent: 'center' },
  accountInfo: { flex: 1 },
  accountName: { color: COLORS.text, fontSize: 16, ...FONT.semibold },
  accountEmail: { color: COLORS.textMuted, fontSize: 13, marginTop: 2 },

  cardDesc: { color: COLORS.textSecondary, fontSize: 14, lineHeight: 20 },
  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  linkText: { color: COLORS.primary, fontSize: 14, ...FONT.medium },

  savedKeyRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: COLORS.bg, borderRadius: RADIUS.md, padding: SPACING.sm },
  savedKeyText: { flex: 1, color: COLORS.textSecondary, fontSize: 13, fontFamily: 'monospace' },

  configureBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.primary, borderRadius: RADIUS.md, padding: 12 },
  configureBtnText: { color: '#fff', fontSize: 15, ...FONT.semibold },

  keyInputWrap: { flexDirection: 'row', gap: SPACING.sm },
  keyInput: { flex: 1, backgroundColor: COLORS.bg, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 10, color: COLORS.text, fontSize: 14, borderWidth: 1, borderColor: COLORS.border },
  saveKeyBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, justifyContent: 'center' },
  saveKeyText: { color: '#fff', ...FONT.semibold },

  catRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: 4 },
  catColorCircle: { width: 14, height: 14, borderRadius: 7 },
  catName: { flex: 1, color: COLORS.text, fontSize: 15 },
  catDeleteBtn: { padding: 4 },

  addCatForm: { gap: SPACING.sm },
  catInput: { backgroundColor: COLORS.bg, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 10, color: COLORS.text, fontSize: 15, borderWidth: 1, borderColor: COLORS.border },
  colorPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  colorOption: { width: 28, height: 28, borderRadius: 14 },
  colorOptionSelected: { borderWidth: 3, borderColor: '#fff' },
  addCatActions: { flexDirection: 'row', gap: SPACING.sm },
  cancelBtn: { flex: 1, padding: 10, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  cancelBtnText: { color: COLORS.textSecondary, ...FONT.medium },
  addBtn: { flex: 1, padding: 10, borderRadius: RADIUS.md, backgroundColor: COLORS.primary, alignItems: 'center' },
  addBtnText: { color: '#fff', ...FONT.semibold },

  addCatBtn: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: 4 },
  addCatBtnText: { color: COLORS.primary, fontSize: 15, ...FONT.medium },

});
