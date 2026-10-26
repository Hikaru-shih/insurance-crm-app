import { Workspace } from './workspace';
export function removeContact(state: Workspace, id: string): Workspace {
  return {...state, contacts:state.contacts.filter(c=>c.id!==id), events:state.events.filter(e=>e.contactId!==id)};
}
