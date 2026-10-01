import { TrackingPanel } from './TrackingPanel';
import { Session } from '../../data/api';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Contact, ContactDraft, Grade, gradeLabel } from '../../domain/contacts';
import { Button, Card, EmptyState, Field, s } from '../../ui/components';
import { ContactRecords } from './ContactRecords';
import { colors as c } from '../../ui/theme';

export function ContactsScreen({ initialContactId, session, contacts, grades, onAdd, onEdit, saving, onSave }: { initialContactId?: string; session: Session; saving: boolean; onSave: (draft: ContactDraft, id?: string) => Promise<Contact>; contacts: Contact[]; grades: Grade[]; onAdd: () => void; onEdit: (contact: Contact) => void }) {
  const [showArchived, setShowArchived] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string>();
  useEffect(() => { setSelectedId(initialContactId); }, [initialContactId]);
  const selected = contacts.find(item => item.id === selectedId);
  const term = query.trim().toLocaleLowerCase();
  const matches = contacts.filter(item => !!item.archived === showArchived && [item.name, item.instagram, ...item.groups].some(value => value.toLocaleLowerCase().includes(term)));
  if (selected) return <View style={{ gap: 20 }}><View style={s.row}><Button secondary onPress={() => setSelectedId(undefined)}>‹ 返回聯絡人</Button><Button onPress={() => onEdit(selected)}>編輯聯絡人</Button></View><Card><Text style={[s.title, { fontSize: 28 }]}>{selected.name}</Text><Text style={s.muted}>{selected.instagram || '尚未填寫 IG'}</Text><View style={s.row}><Text style={{ color: c.green }}>{selected.grade ? `${selected.grade} 級 · ${gradeLabel(grades.find(g => g.code === selected.grade)!)}` : '未分級'}</Text></View>{[['性別', selected.gender], ['IG', selected.instagram], ['群組', selected.groups.join('、')], ['生日', selected.birthday], ['備註', selected.notes]].map(([label, value]) => <View key={label} style={{ gap: 6 }}><Text style={s.label}>{label}</Text><Text selectable style={s.muted}>{value || '尚未填寫'}</Text></View>)}</Card><TrackingPanel key={`tracking:${selected.id}`} contact={selected} grades={grades} session={session} saving={saving} onSave={onSave} /><ContactRecords key={selected.id} contact={selected} saving={saving} onSave={onSave} /></View>;
  return <Card><View style={[s.row, { justifyContent: 'space-between' }]}><Text style={s.title}>我的聯絡人 <Text style={s.muted}> / {contacts.length}</Text></Text><Button onPress={onAdd}>＋ 新增聯絡人</Button></View><Button secondary onPress={() => setShowArchived(!showArchived)}>{showArchived ? '查看使用中的聯絡人' : '查看已封存聯絡人'}</Button><Field label="搜尋聯絡人" value={query} onChange={setQuery} placeholder="搜尋姓名、IG 或群組" />
    {!matches.length ? <EmptyState title={term ? '沒有找到符合的聯絡人' : '從一個名字，開始累積人脈'} description={term ? '試試其他關鍵字，或清除搜尋。' : '只需姓名即可建立，其他資訊可以之後補齊。'}>{!term && <Button secondary onPress={onAdd}>新增第一位聯絡人</Button>}</EmptyState> : matches.map(item => <Pressable accessibilityRole="button" accessibilityLabel={`查看 ${item.name}`} key={item.id} onPress={() => setSelectedId(item.id)} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 15, paddingVertical: 17, borderTopWidth: 1, borderColor: c.line, opacity: pressed ? 0.65 : 1 }]}><View style={{ width: 45, height: 45, borderRadius: 15, backgroundColor: c.pale, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: c.green, fontSize: 18 }}>{item.name.slice(0, 1)}</Text></View><View style={{ flex: 1, gap: 4 }}><Text style={s.label}>{item.name}</Text><Text style={s.muted}>{item.instagram || item.groups.join('、') || '尚未填寫 IG'}</Text></View><Text style={{ color: c.green }}>{item.grade ? `${item.grade} 級` : '未分級'}</Text><Text style={s.muted}>›</Text></Pressable>)}
  </Card>;
}
