import { Brand } from './src/ui/Brand';
import { AppMenu } from './src/features/settings/AppMenu';
import { AccountSecurity } from './src/features/auth/AccountSecurity';
import { ThemeProvider, useTheme } from './src/ui/theme';
import * as SplashScreen from 'expo-splash-screen';
import { AppearanceScreen } from './src/features/settings/AppearanceScreen';
import { SharingScreen } from './src/features/sharing/SharingScreen';
import { accountLink } from './src/features/auth/AccountRecovery';
import * as Crypto from 'expo-crypto';
import { emptyEvent, pendingScheduleEvents, ScheduleEvent } from './src/domain/events';
import { EventEditor } from './src/features/calendar/EventEditor';
import { needsGradeReview } from './src/domain/tracking';
import { creationDate } from './src/domain/followups';
import { ScoreScreen } from './src/features/score/ScoreScreen';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { api, ApiError, apiRepository, persistSession, savedSession, Session } from './src/data/api';
import { AuthScreen } from './src/features/auth/AuthScreen';
import { AdminScreen } from './src/features/admin/AdminScreen';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { contactFollowups, pendingFollowups } from './src/domain/followups';
import { gradeLabel, Contact } from './src/domain/contacts';
import { useWorkspace } from './src/state/useWorkspace';
import { CalendarScreen } from './src/features/calendar/CalendarScreen';
import { ContactsScreen } from './src/features/contacts/ContactsScreen';
import { ContactEditor } from './src/features/contacts/ContactEditor';
import { GradesScreen } from './src/features/settings/GradesScreen';
import { Button, Card, EmptyState, useStyles } from './src/ui/components';
import { useColors, Palette } from './src/ui/theme';

const tabs = [
  { key: 'score', label: '計分卡', symbol: '▥', subtitle: '查看每日業務成果。' },
  { key: 'settings', label: '分級', symbol: '⚙', subtitle: '沿用預設等級，或新增自己的分級。' },
  { key: 'calendar', label: '主頁', symbol: '⌂', subtitle: '掌握日常，讓每次聯繫都有溫度。' },
  { key: 'contacts', label: '聯絡人', symbol: '◎', subtitle: '把每一段關係，好好記下來。' },
  { key: 'pending', label: '未定行程', symbol: '◷', subtitle: '還沒決定日期，也不會忘記。' },
] as const;
type Tab = typeof tabs[number]['key'] | 'admin' | 'sharing' | 'appearance' | 'security';
void SplashScreen.preventAutoHideAsync().catch(()=>{});
export default function App(){return <ThemeProvider><AppContent /></ThemeProvider>;}
function AppContent() {
  const {ready}=useTheme();
  useEffect(()=>{if(ready)void SplashScreen.hideAsync().catch(()=>{});},[ready]);
  const [authKey,setAuthKey]=useState(0);
  const [session, setSession] = useState<Session | null>(()=>accountLink()?null:savedSession());
  useEffect(()=>{
    if(typeof globalThis.addEventListener!=='function')return;
    const changed=()=>{if(accountLink()){setSession(null);setAuthKey(key=>key+1);}};
    globalThis.addEventListener('hashchange',changed);
    return()=>globalThis.removeEventListener('hashchange',changed);
  },[]);
  const clearSession = useCallback(() => { persistSession(null); setSession(null); }, []);
  return <SafeAreaProvider>{session ? <WorkspaceApp key={session.user.id} session={session} onExpired={clearSession} /> : <AuthScreen key={authKey} onLogin={value => { persistSession(value); setSession(value); }} />}</SafeAreaProvider>;
}
function WorkspaceApp({ session, onExpired }: { session: Session; onExpired: () => void }) {
  const s = useStyles();
  const c = useColors();
  const styles = makeStyles(c);
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
  const [menuOpen,setMenuOpen]=useState(false);
  const [selectedContactId, setSelectedContactId] = useState<string>();
  const openContact = (id?: string) => { setSelectedContactId(id); setTab('contacts'); };
  const [eventEditor, setEventEditor] = useState<ScheduleEvent | null>(null);
  const addEvent = (date: string | null) => setEventEditor(emptyEvent(Crypto.randomUUID(), date));
  const [editor, setEditor] = useState<{ contact?: Contact } | null>(null);
  const currentTab = tab === 'security' ? {label:'帳號安全',subtitle:'管理登入與密碼。'} : tab === 'appearance' ? {label:'外觀風格',subtitle:'把工作台換成自己喜歡的樣子。'} : tab === 'sharing' ? {label:'授權分享',subtitle:'選擇誰能查看你的資料。'} : tab === 'admin' ? { label: '管理後台', subtitle: '帳號與管理操作紀錄' } : tabs.find(item => item.key === tab)!;
  const add = () => setEditor({});
  const pendingEvents = pendingFollowups(workspace.contacts, workspace.grades, creationDate(new Date().toISOString())!);
  const pendingFree = pendingScheduleEvents(workspace.events, creationDate(new Date().toISOString())!);
  const datedEvents = workspace.events.filter((e): e is ScheduleEvent & {date: string} => e.date !== null).map(e => ({...e, id: `schedule:${e.id}`}));
  const openEvent = async (event: { id: string; contactId?: string }) => {
    if (event.id.startsWith('schedule:')) setEventEditor(workspace.events.find(e => `schedule:${e.id}` === event.id)!);
    else openContact(event.contactId);
  };
  const pendingCount = workspace.loading || workspace.loadError ? 0 : pendingFree.length + pendingEvents.length + workspace.contacts.filter(c => !c.archived && (!c.grade || needsGradeReview(c) || c.nextContactDate === null)).length;

  return <SafeAreaView style={styles.root}><StatusBar style="dark" /><AppMenu visible={menuOpen} onClose={()=>setMenuOpen(false)} email={session.user.email} items={[{label:"主頁",onPress:()=>setTab("calendar")},{label:"外觀風格",onPress:()=>setTab("appearance")},{label:"授權分享",onPress:()=>setTab("sharing")},{label:"帳號安全",onPress:()=>setTab("security")},...(session.user.role==="admin"?[{label:"管理後台",onPress:()=>setTab("admin")}]:[]),{label:"重新載入資料",onPress:()=>void workspace.reload(),disabled:workspace.saving||workspace.loading},...(workspace.contacts.length===0?[{label:"將本機舊資料匯入此帳號",onPress:()=>void importLegacy(),disabled:workspace.saving||workspace.loading}]:[]),{label:loggingOut?"登出中…":"登出",onPress:()=>void logout(),disabled:loggingOut||workspace.saving}]} /><View style={{ flex: 1, display: editor || eventEditor ? 'none' : 'flex' }}>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: wide ? 36 : 18, gap: 24 }}>
      <View style={[s.row, { justifyContent: 'space-between' }]}><View style={s.row}><Pressable accessibilityRole="button" accessibilityLabel="開啟功能選單" onPress={()=>setMenuOpen(true)} style={{padding:12,gap:5}}>{[0,1,2].map(n=><View key={n} style={{width:22,height:2,backgroundColor:c.ink}} />)}</Pressable><View style={{ gap: 7 }}>{tab === 'calendar' ? <Text style={styles.heading}>錢脈</Text> : <><Text style={styles.eyebrow}>錢脈 · QIANMAI</Text><Text style={styles.heading}>{currentTab.label}</Text><Text style={s.muted}>{currentTab.subtitle}</Text></>}</View></View><Button disabled={workspace.loading || !!workspace.loadError} onPress={add}>＋ 新增聯絡人</Button></View>
      {!!accountError && <Text accessibilityRole="alert" style={s.muted}>{accountError}</Text>}
      {workspace.loading ? <Brand loading /> : workspace.loadError ? <Card><Text style={s.error}>{workspace.loadError}</Text><Button onPress={() => void workspace.reload()}>重試讀取</Button></Card> : <>
        {tab === 'calendar' && <View style={{ flexDirection: wide ? 'row' : 'column', gap: 24 }}><View style={{ flex: 1 }}><CalendarScreen onAddEvent={addEvent} onComplete={openEvent} events={[...contactFollowups(workspace.contacts, workspace.grades), ...datedEvents]} onAddContact={add} /></View><View style={{ width: wide ? 250 : undefined, gap: 20 }}><View style={styles.greenCard}><Text style={{ color: c.accentSoft, fontSize: 12, letterSpacing: 2 }}>持續經營的關係</Text><Text style={{ color: 'white', fontSize: 44, fontWeight: '600', marginTop: 20 }}>{workspace.contacts.length}</Text><Text style={{ color: c.accentSoft, marginBottom: 22 }}>位聯絡人</Text><Button secondary onPress={() => setTab('contacts')}>查看我的聯絡人 →</Button></View><Card><Text style={s.title}>聯絡的節奏</Text>{workspace.grades.map(g => <Text key={g.code} style={s.muted}>{g.code} 級　每 {gradeLabel(g)}</Text>)}<Button secondary onPress={() => setTab('settings')}>管理自訂等級</Button></Card></View></View>}
        {tab === 'calendar' && workspace.events.some(e => e.date === null) && <Card><Text style={s.title}>未定日期行程（含已完成）</Text>{workspace.events.filter(e => e.date === null).map(e => <Button key={e.id} secondary onPress={() => setEventEditor(e)}>{e.title}{e.completed ? '（已完成）' : '（未定日期）'}</Button>)}</Card>}
        {tab === 'contacts' && <ContactsScreen events={workspace.events} onOpenEvent={setEventEditor} initialContactId={selectedContactId} session={session} saving={workspace.saving} onSave={workspace.saveContact} contacts={workspace.contacts} grades={workspace.grades} onAdd={add} onEdit={contact => setEditor({ contact })} />}
        {tab === 'appearance' && <AppearanceScreen />}
        {tab === 'security' && <AccountSecurity session={session} onComplete={onExpired} onBack={()=>setTab("calendar")} />}
        {tab === 'sharing' && <SharingScreen session={session} />}
        {tab === 'admin' && session.user.role === 'admin' && <AdminScreen session={session} />}
        {tab === 'settings' && <GradesScreen onUpdate={workspace.updateGrade} onDelete={workspace.deleteGrade} grades={workspace.grades} saving={workspace.saving} onAdd={workspace.addGrade} />}
        {tab === 'pending' && <CalendarScreen pending onAddEvent={addEvent} events={[...pendingEvents, ...datedEvents.filter(e => !e.completed && e.date <= creationDate(new Date().toISOString())!)]} saving={workspace.saving} onAddContact={add} onComplete={openEvent} />}
        {tab === 'pending' && <Card><Text style={s.title}>未定日期行程</Text><Button onPress={() => addEvent(null)}>＋ 新增未定日期行程</Button>{pendingFree.filter(e => e.date === null).map(e => <Button key={e.id} secondary onPress={() => setEventEditor(e)}>{e.title} · 安排日期</Button>)}</Card>}
        {tab === 'pending' && <Card><Text style={s.title}>待分級／尚未安排日期</Text>{workspace.contacts.filter(c => !c.archived && (!c.grade || needsGradeReview(c) || c.nextContactDate === null)).map(c => <Button key={c.id} secondary onPress={() => openContact(c.id)}>{c.name} · {!c.grade ? '尚未分級' : needsGradeReview(c) ? '待重新分級' : '安排日期'}</Button>)}</Card>}
        {tab === 'score' && <ScoreScreen session={session} />}
      </>}
      <Text style={{ color: c.muted, fontSize: 11, textAlign: 'center', marginVertical: 5 }}>錢脈 · 把關係放在心上，把日常安排妥當。</Text>
    </ScrollView>
    <View style={styles.bottomBar}>
      <View style={styles.bottomTabs}>{tabs.map(item => <Pressable key={item.key} accessibilityRole="button" accessibilityLabel={`${item.symbol} ${item.label}${item.key === 'pending' && pendingCount > 0 ? `，${pendingCount} 筆未完成` : ''}`} accessibilityState={{ selected: tab === item.key }} onPress={() => setTab(item.key)} style={[styles.nav, item.key === 'calendar' && { borderWidth: 1, borderColor: c.line, backgroundColor: c.pale }, tab === item.key && { backgroundColor: c.pale }]}><Text style={{ color: tab === item.key ? c.green : c.muted, fontSize: 22 }}>{item.symbol}</Text>{item.key === 'pending' && pendingCount > 0 && <View style={{ position: 'absolute', top: 2, right: 6, backgroundColor: c.error, borderRadius: 12, minWidth: 20, height: 20, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: 'white', fontSize: 11, fontWeight: '700' }}>{pendingCount > 99 ? '99+' : pendingCount}</Text></View>}<Text style={{ color: tab === item.key ? c.green : c.muted, fontWeight: tab === item.key ? '700' : '400', fontSize: wide ? 14 : 12 }}>{item.label}</Text></Pressable>)}</View>
    </View>
  </View>{editor && <ContactEditor session={session} onAddGrade={workspace.addGrade} contact={editor.contact} grades={workspace.grades} saving={workspace.saving} onSave={workspace.saveContact} onClose={() => setEditor(null)} />}{eventEditor && <EventEditor session={session} grades={workspace.grades} onComplete={workspace.completeEvent} onOpenContact={id=>{setEventEditor(null);openContact(id);}} contacts={workspace.contacts} event={eventEditor} existing={workspace.events.some(e => e.id === eventEditor.id)} saving={workspace.saving} onSave={workspace.saveEvent} onDelete={workspace.deleteEvent} onClose={() => setEventEditor(null)} />}</SafeAreaView>;
}
const makeStyles = (c: Palette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.background }, bottomBar: { backgroundColor: c.paper, borderTopWidth: 1, borderColor: c.line, paddingHorizontal: 8, paddingVertical: 8 }, bottomTabs: { flexDirection: 'row', width: '100%', maxWidth: 800, alignSelf: 'center', gap: 4 }, nav: { flex: 1, minWidth: 0, minHeight: 60, gap: 4, paddingVertical: 8, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, heading: { fontSize: 32, fontWeight: '700', color: c.ink, letterSpacing: 1 }, eyebrow: { color: c.gold, letterSpacing: 3, fontSize: 11, fontWeight: '600' }, notice: { backgroundColor: c.pale, padding: 12, borderRadius: 10 }, greenCard: { backgroundColor: c.green, borderWidth: 1, borderColor: c.gold, borderRadius: c.radius, padding: 24 },
});
