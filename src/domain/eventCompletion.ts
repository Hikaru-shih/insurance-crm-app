import { Workspace } from './workspace';
import { ScheduleEvent, saveEvent } from './events';
import { changeTracking } from './tracking';

export type EventCompletion = {id:string;date:string;content:string;scoreCode:string;gradeCode:string;next:string|null};
export function completeSchedule(state:Workspace,draft:ScheduleEvent,input:EventCompletion):Workspace {
  const original=state.events.find(e=>e.id===draft.id);
  if(original?.recordId && original.contactId!==draft.contactId)throw new Error('已有聯絡紀錄的行程不可更換聯絡人。');
  const contact=state.contacts.find(c=>c.id===draft.contactId);
  if(!contact)throw new Error('請先選擇聯絡人。');
  if(original?.recordId && contact.records?.some(r=>r.id===original.recordId)){
    return {...state,events:saveEvent(state.events,{...draft,completed:true,recordId:original.recordId})};
  }
  if(contact.records?.some(r=>r.id===input.id)||contact.trackingHistory?.some(h=>h.id===input.id))throw new Error('此操作已存在，請重新載入行程。');
  const updated=changeTracking(contact,state.grades,{...input,kind:'complete'});
  const completed={...draft,completed:true,recordId:input.id};
  // A deleted/undone record can be explicitly recreated with a fresh operation ID.
  const events=saveEvent(state.events.map(e=>e.id===draft.id?{...e,recordId:undefined}:e),completed);
  return {...state,contacts:state.contacts.map(c=>c.id===contact.id?{...updated,updatedAt:new Date().toISOString()}:c),events};
}
