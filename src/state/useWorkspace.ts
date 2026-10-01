import { useCallback, useEffect, useRef, useState } from 'react';
import * as Crypto from 'expo-crypto';
import { ContactDraft, IntervalUnit, createGrade, validateContact } from '../domain/contacts';
import { emptyWorkspace, localRepository, Workspace, WorkspaceRepository } from '../data/repository';

export function useWorkspace(repository: WorkspaceRepository = localRepository) {
  const [data, setData] = useState<Workspace>(emptyWorkspace);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const current = useRef(data);
  const reload = useCallback(async () => {
    setLoading(true); setLoadError('');
    try { const loaded = await repository.load(); current.current = loaded; setData(loaded); }
    catch (e) { setLoadError(e instanceof Error ? e.message : '資料讀取失敗，請重試。'); }
    finally { setLoading(false); }
  }, [repository]);
  useEffect(() => { void reload(); }, [reload]);
  const commit = async (change: (state: Workspace) => Workspace) => {
    if (loading || loadError) throw new Error('資料尚未載入完成，請稍後重試。');
    if (busy.current) throw new Error('資料儲存中，請稍候。');
    busy.current = true; setSaving(true);
    try { const next = change(current.current); const saved = await repository.save(next); current.current = saved; setData(saved); }
    catch (error) { throw new Error(error instanceof Error ? error.message : '儲存失敗，請重試。'); }
    finally { busy.current = false; setSaving(false); }
  };
  const saveContact = async (draft: ContactDraft, id?: string) => {
    const contactId = id ?? Crypto.randomUUID();
    const problem = validateContact(draft); if (problem) throw new Error(problem);
    await commit(state => {
      if (draft.grade && !state.grades.some(g => g.code === draft.grade)) throw new Error('請選擇有效的客戶等級。');
      const old = id ? state.contacts.find(c => c.id === id) : undefined;
      if (id && !old) throw new Error('找不到這位聯絡人。');
      const now = new Date().toISOString();
      const contact = { ...draft, name: draft.name.trim(), groups: [...new Set(draft.groups.map(g => g.trim()).filter(Boolean))], email: draft.email.trim(), importantDates: draft.importantDates.map(d => ({ ...d, label: d.label.trim() })), id: contactId, createdAt: old?.createdAt ?? now, updatedAt: now };
      return { ...state, contacts: old ? state.contacts.map(c => c.id === id ? contact : c) : [contact, ...state.contacts] };
    });
    return current.current.contacts.find(contact => contact.id === contactId)!;
  };
  const addGrade = async (code: string, amount: number, unit: IntervalUnit) => {
    await commit(state => ({ ...state, grades: [...state.grades, createGrade(code, amount, unit, state.grades)] }));
  };
  const updateGrade = async (code: string, amount: number, unit: IntervalUnit) => {
    await commit(state => {
      const old = state.grades.find(g => g.code === code);
      if (!old || old.fixed) throw new Error('固定等級不可修改。');
      const grade = createGrade(code, amount, unit, state.grades.filter(g => g.code !== code));
      return {...state, grades: state.grades.map(g => g.code === code ? grade : g)};
    });
  };
  const deleteGrade = async (code: string) => {
    await commit(state => {
      if (state.grades.find(g => g.code === code)?.fixed) throw new Error('固定等級不可刪除。');
      if (state.contacts.some(c => c.grade === code)) throw new Error('此等級仍被聯絡人使用，請先變更聯絡人的分級。');
      return {...state, grades: state.grades.filter(g => g.code !== code)};
    });
  };
  const importLegacy = async () => {
    const legacy = await localRepository.load();
    if (!legacy.contacts.length) throw new Error('此裝置沒有舊版聯絡人可匯入。');
    await commit(state => {
      if (state.contacts.length || state.revision !== 0) throw new Error('只能匯入至全新的空白帳號，以避免覆蓋資料。');
      return { ...legacy, revision: state.revision };
    });
  };
  return { ...data, loading, loadError, saving, reload, saveContact, addGrade, updateGrade, deleteGrade, importLegacy };
}
