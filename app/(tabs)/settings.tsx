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
  const { user, signOut, isAdmin } = useAuth();
  const [groqKey, setGroqKey] = useState('');
  const [savedKey, setSavedKey] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState(CATEGORY_COLORS[0]);
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [showAddCat, setShowAddCat] = useState(false);

  const loadData = useCallback(async () => {
    const key = await AsyncStorage.getItem('groq_api_key');
    if (key) {
      setSavedKey(key);
      setGroqKey(key);
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
    if (!groqKey.trim()) {
      alert('Erro', 'Digite uma chave válida.');
      return;
    }
    await AsyncStorage.setItem('groq_api_key', groqKey.trim());
    setSavedKey(groqKey.trim());
    setShowKeyInput(false);
    alert('✅ Salvo', 'Chave Groq configurada com sucesso!');
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

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#0F0F1A', '#1A1A2E']} style={StyleSheet.absoluteFill} />

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Configurações</Text>
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>CONTA</Text>
          <View style={styles.card}>
            <View style={styles.accountRow}>
              <View style={styles.avatar}>
                <Ionicons name="person" size={24} color={COLORS.primary} />
              </View>
              <View style={styles.accountInfo}>
                <Text style={styles.accountName}>
                  {user?.user_metadata?.full_name ?? (isAdmin ? 'Admin' : 'Usuário')}
                </Text>
                <Text style={styles.accountEmail}>{user?.email ?? 'Não conectado'}</Text>
              </View>
              <TouchableOpacity onPress={signOut}>
                <Ionicons name="log-out-outline" size={22} color={COLORS.error} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Groq API Key Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔑 CHAVE GROQ (TRANSCRIÇÃO)</Text>
          <View style={styles.card}>
            <Text style={styles.cardDesc}>
              A Groq transcreve seu áudio (Whisper) e interpreta suas tarefas <Text style={{ color: COLORS.accent }}>gratuitamente</Text> dentro dos limites diários do plano gratuito.
            </Text>

            <TouchableOpacity
              style={styles.linkBtn}
              onPress={() => alert('Obter Chave Groq', 'Acesse console.groq.com/keys no seu navegador, faça login (ou crie uma conta) e gere uma API Key.')}
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
                  placeholder="gsk_..."
                  placeholderTextColor={COLORS.textMuted}
                  value={groqKey}
                  onChangeText={setGroqKey}
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
