import { useState } from 'react';
import { Modal, Text, View } from 'react-native';
import { Contact, ContactDraft, ContactRecord } from '../../domain/contacts';
import { creationDate } from '../../domain/followups';
import { Button, Card, Field, s } from '../../ui/components';

export function ContactRecords({ contact, saving, onSave }: { contact: Contact; saving: boolean; onSave: (draft: ContactDraft, id?: string) => Promise<Contact> }) {
  const [editing, setEditing] = useState<ContactRecord | null>(null);
  const [deleting, setDeleting] = useState<ContactRecord | null>(null);
  const [error, setError] = useState('');
  const save = async () => {
    if (!editing || saving) return;
    try {
      setError('');
      await onSave({ ...contact, records: (contact.records ?? []).map(record => record.id === editing.id ? editing : record) }, contact.id);
      setEditing(null);
    } catch (e) { setError(e instanceof Error ? e.message : '儲存失敗，請重試。'); }
  };
  const remove = async () => {
    if (!deleting || saving) return;
    try {
      setError('');
      await onSave({ ...contact, records: (contact.records ?? []).filter(record => record.id !== deleting.id) }, contact.id);
      setDeleting(null);
    } catch (e) { setError(e instanceof Error ? e.message : '刪除失敗，請重試。'); }
  };
  return <Card><Text style={s.title}>聯絡紀錄</Text>
    {(contact.records ?? []).map(record => <View key={record.id} style={{ gap: 12, paddingVertical: 12 }}>
      <Text style={s.label}>{record.date}</Text><Text selectable style={s.muted}>{record.content}</Text>
      <View style={s.row}><Button secondary disabled={saving} onPress={() => { setError(''); setEditing({ ...record }); }}>編輯紀錄</Button><Button secondary disabled={saving} onPress={() => { setError(''); setDeleting(record); }}>刪除紀錄</Button></View>
    </View>)}
    <Text style={s.muted}>{creationDate(contact.createdAt) ?? '日期不明'} · 新增聯絡人</Text>
    <Modal visible={!!editing || !!deleting} transparent animationType="fade" onRequestClose={() => { if (!saving) { setEditing(null); setDeleting(null); } }}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <View accessibilityViewIsModal style={{ width: '100%', maxWidth: 520, backgroundColor: 'white', borderRadius: 16, padding: 24, gap: 16 }}>
          <Text style={s.title}>{editing ? '編輯紀錄' : '確定刪除此筆紀錄？'}</Text>
          {editing ? <><Field label="紀錄日期（YYYY-MM-DD）" value={editing.date} onChange={date => setEditing({ ...editing, date })} /><Field label="紀錄內容" value={editing.content} onChange={content => setEditing({ ...editing, content })} multiline /></> : <Text style={s.muted}>{deleting?.date} · {deleting?.content}</Text>}
          {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
          <View style={s.row}><Button secondary disabled={saving} onPress={() => { setEditing(null); setDeleting(null); }}>取消</Button><Button disabled={saving} onPress={() => void (editing ? save() : remove())}>{saving ? '處理中…' : editing ? '儲存紀錄' : '確認刪除'}</Button></View>
        </View>
      </View>
    </Modal>
  </Card>;
}
