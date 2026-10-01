import { TodaySummary } from './src/features/score/TodaySummary';
import { creationDate } from './src/domain/followups';
import { ScoreScreen } from './src/features/score/ScoreScreen';
import { useState, useMemo, useCallback } from 'react';
import { api, ApiError, apiRepository, persistSession, savedSession, Session } from './src/data/api';
import { AuthScreen } from './src/features/auth/AuthScreen';
import { AdminScreen } from './src/features/admin/AdminScreen';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { contactFollowups, pendingFollowups } from './src/domain/followups';
import { Contact } from './src/domain/contacts';
import { useWorkspace } from './src/state/useWorkspace';
import { CalendarScreen } from './src/features/calendar/CalendarScreen';
import { ContactsScreen } from './src/features/contacts/ContactsScreen';
import { ContactEditor } from './src/features/contacts/ContactEditor';
import { GradesScreen } from './src/features/settings/GradesScreen';
import { Button, Card, EmptyState, s } from './src/ui/components';
import { colors as c } from './src/ui/theme';

const tabs = [
  { key: 'score', label: '計分卡', symbol: '▥', subtitle: '查看每日業務成果。' },
  { key: 'settings', label: '分級', symbol: '⚙', subtitle: '沿用預設等級，或新增自己的分級。' },
  { key: 'calendar', label: '主頁', symbol: '⌂', subtitle: '掌握日常，讓每次聯繫都有溫度。' },
  { key: 'contacts', label: '聯絡人', symbol: '◎', subtitle: '把每一段關係，好好記下來。' },
  { key: 'pending', label: '未定行程', symbol: '◷', subtitle: '還沒決定日期，也不會忘記。' },
] as const;
type Tab = typeof tabs[number]['key'] | 'admin';
export default function App() {
  const [session, setSession] = useState<Session | null>(savedSession);
  const clearSession = useCallback(() => { persistSession(null); setSession(null); }, []);
  return <SafeAreaProvider>{session ? <WorkspaceApp key={session.user.id} session={session} onExpired={clearSession} /> : <AuthScreen onLogin={value => { persistSession(value); setSession(value); }} />}</SafeAreaProvider>;
}
function WorkspaceApp({ session, onExpired }: { session: Session; onExpired: () => void }) {
  const repository = useMemo(() => apiRepository(session, onExpired), [session, onExpired]);
  const workspace = useWorkspace(repository);
  const [accountError, setAccountError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  const logout = async () => {
    setLoggingOut(true);
    try { await api('/api/auth/logout', session.token, 'POST'); onExpired(); }
    catch (e) { if (e instanceof ApiError && e.status === 401) onExpired(); else setAccountError(e instanceof Error ? e.message : '登出失敗，請重試'); }
    finally { setLoggingOut(false); }
  };
  const importLegacy = async () => { try { await workspace.importLegacy(); setAccountError('舊版資料已匯入，原始本機資料仍保留。'); } catch (e) { setAccountError(e instanceof Error ? e.message : '匯入失敗'); } };
  const { width } = useWindowDimensions(); const wide = width >= 1000;
  const [tab, setTab] = useState<Tab>('calendar');
  const [selectedContactId, setSelectedContactId] = useState<string>();
  const openContact = (id?: string) => { setSelectedContactId(id); setTab('contacts'); };
  const [editor, setEditor] = useState<{ contact?: Contact } | null>(null);
  const currentTab = tab === 'admin' ? { label: '管理後台', subtitle: '帳號與管理操作紀錄' } : tabs.find(item => item.key === tab)!;
  const add = () => setEditor({});
  const pendingEvents = pendingFollowups(workspace.contacts, workspace.grades, creationDate(new Date().toISOString())!);
  const pendingCount = workspace.loading || workspace.loadError ? 0 : pendingEvents.length + workspace.contacts.filter(c => !c.archived && c.nextContactDate === null).length;

  return <SafeAreaView style={styles.root}><StatusBar style="dark" /><View style={{ flex: 1, display: editor ? 'none' : 'flex' }}>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: wide ? 36 : 18, gap: 24 }}>
      <View style={[s.row, { justifyContent: 'space-between' }]}><View style={{ gap: 7 }}><Text style={styles.eyebrow}>錢脈 · QIANMAI</Text><Text style={styles.heading}>{tab === 'calendar' ? '我的一天' : currentTab.label}</Text><Text style={s.muted}>{currentTab.subtitle}</Text></View><Button disabled={workspace.loading || !!workspace.loadError} onPress={add}>＋ 新增聯絡人</Button></View>
      <View style={styles.notice}><Text style={{ color: c.green, fontSize: 12, lineHeight: 20 }}>開發環境：資料儲存在本機後端資料庫，已依帳號隔離。請使用假資料測試。</Text></View>
      <View style={s.row}><Text style={s.muted}>{session.user.email}</Text><Button secondary disabled={loggingOut || workspace.saving} onPress={() => void logout()}>{loggingOut ? '登出中…' : '登出'}</Button>{session.user.role === 'admin' && <Button secondary onPress={() => setTab('admin')}>管理後台</Button>}<Button secondary disabled={workspace.saving || workspace.loading} onPress={() => void workspace.reload()}>重新載入資料</Button>{workspace.contacts.length === 0 && <Button secondary disabled={workspace.saving || workspace.loading} onPress={() => void importLegacy()}>將本機舊資料匯入此帳號</Button>}</View>
      {!!accountError && <Text accessibilityRole="alert" style={s.muted}>{accountError}</Text>}
      {workspace.loading ? <ActivityIndicator size="large" color={c.green} /> : workspace.loadError ? <Card><Text style={s.error}>{workspace.loadError}</Text><Button onPress={() => void workspace.reload()}>重試讀取</Button></Card> : <>
        {tab === 'calendar' && <TodaySummary session={session} revision={workspace.revision} due={contactFollowups(workspace.contacts,workspace.grades).filter(event => event.date === creationDate(new Date().toISOString())).length} onScore={() => setTab('score')} />}
        {tab === 'calendar' && <View style={{ flexDirection: wide ? 'row' : 'column', gap: 24 }}><View style={{ flex: 1 }}><CalendarScreen onComplete={async event => openContact(event.contactId)} events={contactFollowups(workspace.contacts, workspace.grades)} onAddContact={add} /></View><View style={{ width: wide ? 250 : undefined, gap: 20 }}><View style={styles.greenCard}><Text style={{ color: '#E7CD96', fontSize: 12, letterSpacing: 2 }}>持續經營的關係</Text><Text style={{ color: 'white', fontSize: 44, fontWeight: '600', marginTop: 20 }}>{workspace.contacts.length}</Text><Text style={{ color: '#F3E4C8', marginBottom: 22 }}>位聯絡人</Text><Button secondary onPress={() => setTab('contacts')}>查看我的聯絡人 →</Button></View><Card><Text style={s.title}>聯絡的節奏</Text><Text style={s.muted}>A 級　每 1 週</Text><Text style={s.muted}>B 級　每 1 個月</Text><Text style={s.muted}>C 級　每 3 個月</Text><Button secondary onPress={() => setTab('settings')}>管理自訂等級</Button></Card></View></View>}
        {tab === 'contacts' && <ContactsScreen initialContactId={selectedContactId} session={session} saving={workspace.saving} onSave={workspace.saveContact} contacts={workspace.contacts} grades={workspace.grades} onAdd={add} onEdit={contact => setEditor({ contact })} />}
        {tab === 'admin' && session.user.role === 'admin' && <AdminScreen session={session} />}
        {tab === 'settings' && <GradesScreen onUpdate={workspace.updateGrade} onDelete={workspace.deleteGrade} grades={workspace.grades} saving={workspace.saving} onAdd={workspace.addGrade} />}
        {tab === 'pending' && <CalendarScreen pending events={pendingEvents} saving={workspace.saving} onAddContact={add} onComplete={async event => openContact(event.contactId)} />}
        {tab === 'pending' && <Card><Text style={s.title}>尚未安排日期</Text>{workspace.contacts.filter(c => !c.archived && c.nextContactDate === null).map(c => <Button key={c.id} secondary onPress={() => openContact(c.id)}>{c.name} · 安排日期</Button>)}</Card>}
        {tab === 'score' && <ScoreScreen session={session} />}
      </>}
      <Text style={{ color: '#897457', fontSize: 11, textAlign: 'center', marginVertical: 5 }}>錢脈 · 把關係放在心上，把日常安排妥當。</Text>
    </ScrollView>
    <View style={styles.bottomBar}>
      <View style={styles.bottomTabs}>{tabs.map(item => <Pressable key={item.key} accessibilityRole="button" accessibilityLabel={`${item.symbol} ${item.label}${item.key === 'pending' && pendingCount > 0 ? `，${pendingCount} 筆未完成` : ''}`} accessibilityState={{ selected: tab === item.key }} onPress={() => setTab(item.key)} style={[styles.nav, item.key === 'calendar' && { borderWidth: 1, borderColor: c.line, backgroundColor: c.pale }, tab === item.key && { backgroundColor: c.pale }]}><Text style={{ color: tab === item.key ? c.green : c.muted, fontSize: 22 }}>{item.symbol}</Text>{item.key === 'pending' && pendingCount > 0 && <View style={{ position: 'absolute', top: 2, right: 6, backgroundColor: c.error, borderRadius: 12, minWidth: 20, height: 20, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: 'white', fontSize: 11, fontWeight: '700' }}>{pendingCount > 99 ? '99+' : pendingCount}</Text></View>}<Text style={{ color: tab === item.key ? c.green : c.muted, fontWeight: tab === item.key ? '700' : '400', fontSize: wide ? 14 : 12 }}>{item.label}</Text></Pressable>)}</View>
    </View>
  </View>{editor && <ContactEditor session={session} onAddGrade={workspace.addGrade} contact={editor.contact} grades={workspace.grades} saving={workspace.saving} onSave={workspace.saveContact} onClose={() => setEditor(null)} />}</SafeAreaView>;
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: c.background }, bottomBar: { backgroundColor: '#FFFFFF', borderTopWidth: 1, borderColor: c.line, paddingHorizontal: 8, paddingVertical: 8 }, bottomTabs: { flexDirection: 'row', width: '100%', maxWidth: 800, alignSelf: 'center', gap: 4 }, nav: { flex: 1, minWidth: 0, minHeight: 60, gap: 4, paddingVertical: 8, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, heading: { fontSize: 32, fontWeight: '700', color: c.ink, letterSpacing: 1 }, eyebrow: { color: c.gold, letterSpacing: 3, fontSize: 11, fontWeight: '600' }, notice: { backgroundColor: '#EEF2E9', padding: 12, borderRadius: 10 }, greenCard: { backgroundColor: c.green, borderWidth: 0, borderColor: c.gold, borderRadius: 22, padding: 24 },
});
