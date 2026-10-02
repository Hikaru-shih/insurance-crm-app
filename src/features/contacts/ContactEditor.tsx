import { reviewContactGrade, needsGradeReview } from '../../domain/tracking';
import { api, Session } from '../../data/api';
import * as Crypto from 'expo-crypto';
import { useEffect, useState } from 'react';
import { BackHandler, Modal, Pressable, ScrollView, StyleSheet, Text, View, KeyboardAvoidingView, Platform } from 'react-native';
import { Contact, ContactDraft, Grade, IntervalUnit, createGrade, emptyContact, gradeLabel } from '../../domain/contacts';
import { creationDate } from '../../domain/followups';
import { Button, Field, s } from '../../ui/components';
import { colors as c } from '../../ui/theme';

export function ContactEditor({ session, contact, grades, saving, onSave, onClose, onAddGrade }: { session: Session; contact?: Contact; grades: Grade[]; saving: boolean; onSave: (draft: ContactDraft, id?: string) => Promise<Contact>; onClose: () => void; onAddGrade: (code: string, amount: number, unit: IntervalUnit) => Promise<void> }) {
  const [draft, setDraft] = useState<ContactDraft>(contact ? { ...contact, importantDates: contact.importantDates.map(d => ({ ...d })) } : emptyContact());
  const [scoreRules, setScoreRules] = useState<{code: string; label: string; points: number}[]>([]);
  useEffect(() => { api<typeof scoreRules>('/api/kpi-rules', session.token).then(setScoreRules).catch(() => setError('無法讀取計分項目，請重新開啟編輯頁。')); }, [session.token]);
  const [section, setSection] = useState<'grades' | 'home' | 'records'>('home');
  const [addingGrade, setAddingGrade] = useState(false);
  const [gradeName, setGradeName] = useState('');
  const [gradeAmount, setGradeAmount] = useState('');
  const [gradeUnit, setGradeUnit] = useState<IntervalUnit>('day');
  const [gradeError, setGradeError] = useState('');
  const [error, setError] = useState('');
  const [savedDraft, setSavedDraft] = useState(() => JSON.stringify(draft));
  const [createdAt, setCreatedAt] = useState(contact?.createdAt);
  const [contactId, setContactId] = useState(contact?.id);
  const [saved, setSaved] = useState(false);
  const dirty = JSON.stringify(draft) !== savedDraft;
  const [editingRecord, setEditingRecord] = useState<string | null>(null);
  const [deletingRecord, setDeletingRecord] = useState<string | null>(null);
  const [discard, setDiscard] = useState(false);
  const set = <K extends keyof ContactDraft>(key: K, value: ContactDraft[K]) => { setSaved(false); setDraft(d => ({ ...d, [key]: value })); setError(''); };
  const addGrade = async () => {
    try {
      setGradeError('');
      const grade = createGrade(gradeName, Number(gradeAmount), gradeUnit, grades);
      await onAddGrade(grade.code, grade.amount, grade.unit);
      setDraft(d => reviewContactGrade(d, grade.code, [...grades, grade])); setSaved(false);
      setAddingGrade(false); setGradeName(''); setGradeAmount('');
    } catch (e) { setGradeError(e instanceof Error ? e.message : '新增等級失敗，請重試。'); }
  };
  const close = () => { if (saving) return; dirty ? setDiscard(true) : onClose(); };
  const save = async () => { try { setError(''); const snapshot = JSON.stringify(draft); const result = await onSave(draft, contactId); setContactId(result.id); setCreatedAt(result.createdAt); setDraft(result); setSavedDraft(JSON.stringify(result)); setSaved(true); setDiscard(false); } catch (e) { setError(e instanceof Error ? e.message : '儲存失敗，請重試。'); } };
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { close(); return true; });
    return () => subscription.remove();
  }, [saving, dirty, onClose]);
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.page}>
      <View style={styles.content}>
        <View style={[s.row, { padding: 24, borderBottomWidth: 1, borderColor: c.line, justifyContent: 'space-between' }]}>
          <View><Text style={s.title}>{contactId ? '編輯聯絡人' : '新增聯絡人'}</Text><Text style={s.muted}>先記下姓名，其他資訊可以慢慢補齊。</Text></View>
          <View style={s.row}><Button secondary disabled={saving} label="返回上一頁" onPress={close}>返回</Button><Button disabled={saving} onPress={() => void save()}>{saving ? '儲存中…' : '儲存'}</Button></View>
        </View>
        <ScrollView style={{ flex: 1, display: section === 'home' ? 'flex' : 'none' }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, gap: 18 }}>
          <Field label="姓名（必填）" value={draft.name} onChange={v => set('name', v)} placeholder="如何稱呼這位客戶？" />
          <Field label="性別" value={draft.gender} onChange={v => set('gender', v)} placeholder="選填" />
          <Field label="IG" value={draft.instagram} onChange={v => set('instagram', v)} placeholder="IG 帳號或個人頁連結（選填）" />
          <Field label="群組" value={draft.groups.join('、')} onChange={v => set('groups', v.split(/[、,，]/))} placeholder="例如：朋友、同事（選填）" />
          <Field label="生日（YYYY-MM-DD）" value={draft.birthday} onChange={v => set('birthday', v)} placeholder="例如 1995-05-20（選填）" />
          <Field label="備註" value={draft.notes} onChange={v => set('notes', v)} placeholder="記下一點關於這位客戶的事…" multiline />
        </ScrollView>
        {section === 'grades' && <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, gap: 18 }}>
          <Text style={s.label}>客戶等級</Text>{needsGradeReview(draft) && <Text style={s.error}>本次聯絡尚未重新分級；請選一次等級（可沿用原等級），儲存後才安排下次聯絡。</Text>}
          <View style={s.row}>{[{ code: '', text: '未分級' }, ...grades.map(g => ({ code: g.code, text: `${g.code} · ${gradeLabel(g)}` }))].map(g => <Pressable key={g.code} accessibilityRole="button" accessibilityState={{ selected: draft.grade === g.code }} onPress={() => { if (g.code) { setDraft(d => reviewContactGrade(d, g.code, grades)); setSaved(false); } else set('grade', ''); }} style={[styles.chip, draft.grade === g.code && { backgroundColor: c.green }]}><Text style={{ color: draft.grade === g.code ? 'white' : c.green }}>{g.text}</Text></Pressable>)}</View>

          <Button secondary disabled={saving} onPress={() => setAddingGrade(value => !value)}>{addingGrade ? '收起新增等級' : '＋ 新增等級'}</Button>
          {addingGrade && <View style={{ padding: 16, gap: 16, backgroundColor: c.background, borderRadius: 12 }}>
            <Field label="等級名稱" value={gradeName} onChange={setGradeName} placeholder="例如 D、AA、VIP、重點客戶" />
            <Field label="聯絡間隔" value={gradeAmount} onChange={setGradeAmount} keyboardType="number-pad" placeholder="例如 2" />
            <View style={s.row}>{(['day', 'week', 'month'] as const).map(unit => <Button key={unit} secondary={gradeUnit !== unit} onPress={() => setGradeUnit(unit)}>{{ day: '天', week: '週', month: '月' }[unit]}</Button>)}</View>
            <Text style={s.muted}>新增會保存至共用分級清單；套用到此聯絡人仍需按上方「儲存」。</Text>
            {!!gradeError && <Text accessibilityRole="alert" style={s.error}>{gradeError}</Text>}
            <Button disabled={saving} onPress={() => void addGrade()}>{saving ? '新增中…' : '新增並選用'}</Button>
          </View>}
          <Text style={s.muted}>選擇既有等級後，按上方「儲存」才會套用至此聯絡人。可在此新增自訂等級。</Text>
        </ScrollView>}
        {section === 'records' && <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, gap: 18 }}>
          <Text style={s.title}>{draft.name || '此聯絡人'}的聯絡紀錄</Text>
          <Button secondary disabled={saving} onPress={() => { const id = Crypto.randomUUID(); set('records', [{ id, date: creationDate(new Date().toISOString())!, content: '', reviewGrade: '' }, ...(draft.records ?? [])]); setEditingRecord(id); }}>＋ 新增紀錄</Button>
          <Text style={s.muted}>新增、編輯或刪除紀錄後，按上方「儲存」才會保存。</Text>
          {(draft.records ?? []).map(record => <View key={record.id} style={{ padding: 16, gap: 12, borderRadius: 12, backgroundColor: c.background }}>
            {editingRecord === record.id ? <><Field label="紀錄日期（YYYY-MM-DD）" value={record.date} onChange={date => set('records', draft.records!.map(item => item.id === record.id ? { ...item, date } : item))} />
            <Text style={s.label}>計分項目</Text><View style={s.row}>{[{code: '', label: '不計分', points: 0}, ...scoreRules].map(rule => <Button key={rule.code} secondary={(record.scoreCode ?? '') !== rule.code} disabled={saving} onPress={() => set('records', draft.records!.map(item => item.id === record.id ? {...item, scoreCode: rule.code} : item))}>{rule.label}{rule.code ? ` · ${rule.points} 分` : ''}</Button>)}</View>
            <Field label="紀錄內容" value={record.content} onChange={content => set('records', draft.records!.map(item => item.id === record.id ? { ...item, content } : item))} placeholder="例如：今天電話聯繫，客戶希望下週再討論。" multiline /></> : <><Text style={s.label}>{record.date}</Text><Text style={s.muted}>{record.content || '尚未填寫內容'}</Text></>}
            <View style={s.row}><Button secondary disabled={saving} onPress={() => setEditingRecord(editingRecord === record.id ? null : record.id)}>{editingRecord === record.id ? '完成編輯' : '編輯紀錄'}</Button><Button secondary disabled={saving} onPress={() => setDeletingRecord(record.id)}>刪除紀錄</Button></View>
          </View>)}
          <Text style={s.muted}>{createdAt ? `${creationDate(createdAt) ?? '日期不明'} · 新增聯絡人` : '儲存聯絡人後，會在此記錄建立日期。'}</Text>
        </ScrollView>}
        {saved && !dirty && <Text accessibilityLiveRegion="polite" style={[s.muted, { padding: 16 }]}>已儲存</Text>}
        {!!error && <Text accessibilityRole="alert" style={[s.error, { padding: 16 }]}>{error}</Text>}
        <Modal visible={deletingRecord !== null} transparent animationType="fade" onRequestClose={() => setDeletingRecord(null)}><View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 24 }}><View accessibilityViewIsModal style={{ width: '100%', maxWidth: 400, backgroundColor: c.paper, borderRadius: 16, padding: 24, gap: 20 }}><Text style={s.title}>確定刪除此筆紀錄？</Text><Text style={s.muted}>刪除後需按上方「儲存」才會生效。</Text><View style={s.row}><Button secondary onPress={() => setDeletingRecord(null)}>取消刪除</Button><Button disabled={saving} onPress={() => { set('records', (draft.records ?? []).filter(record => record.id !== deletingRecord)); if (editingRecord === deletingRecord) setEditingRecord(null); setDeletingRecord(null); }}>確認刪除</Button></View></View></View></Modal>
        <Modal visible={discard} transparent animationType="fade" onRequestClose={() => setDiscard(false)}><View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 24 }}><View accessibilityViewIsModal style={{ width: '100%', maxWidth: 400, backgroundColor: c.paper, borderRadius: 16, padding: 24, gap: 20 }}><Text style={s.title}>尚有未儲存的修改</Text><Text style={s.muted}>返回會放棄這次修改，確定要離開嗎？</Text><View style={s.row}><Button secondary onPress={() => setDiscard(false)}>繼續編輯</Button><Button onPress={onClose}>放棄修改並返回</Button></View></View></View></Modal>
        <View style={{ flexDirection: 'row', borderTopWidth: 1, borderColor: c.line, padding: 8, gap: 8 }}>
          {([{ key: 'grades', label: '分級' }, { key: 'home', label: '主頁' }, { key: 'records', label: '紀錄' }] as const).map(item => <Pressable key={item.key} accessibilityRole="button" accessibilityState={{ selected: section === item.key }} onPress={() => setSection(item.key)} style={{ flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: section === item.key ? c.pale : c.paper }}><Text style={{ color: c.green, fontWeight: section === item.key ? '700' : '400' }}>{item.label}</Text></Pressable>)}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: c.background }, content: { flex: 1, width: '100%', backgroundColor: c.paper }, chip: { padding: 12, borderRadius: 9, backgroundColor: c.pale } });
