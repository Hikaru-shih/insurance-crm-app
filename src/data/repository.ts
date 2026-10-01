import AsyncStorage from '@react-native-async-storage/async-storage';
import { emptyWorkspace, parseWorkspace, Workspace } from '../domain/workspace';
export { emptyWorkspace, Workspace } from '../domain/workspace';
export interface WorkspaceRepository { load(): Promise<Workspace>; save(data: Workspace): Promise<Workspace>; }
const KEY = 'qianmai.local-workspace.v1';
export const localRepository: WorkspaceRepository = {
  async load() { const raw = await AsyncStorage.getItem(KEY); return raw === null ? emptyWorkspace() : parseWorkspace(JSON.parse(raw)); },
  async save(data) { const next = parseWorkspace(data); await AsyncStorage.setItem(KEY, JSON.stringify(next)); return next; },
};
