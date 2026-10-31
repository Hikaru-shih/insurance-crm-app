import { Contact } from './contacts';
import { creationDate } from './followups';
export type DailyActivity = {id:string;date:string;contactId:string;title:string;content:string;code?:string};
export function dailyActivities(contacts: readonly Contact[]): DailyActivity[] {
  return contacts.flatMap(contact=>[
    {id:`created:${contact.id}`,date:creationDate(contact.createdAt)!,contactId:contact.id,title:`新增聯絡人 · ${contact.name}`,content:''},
    ...(contact.records??[]).map(record=>({id:`record:${contact.id}:${record.id}`,date:record.date,contactId:contact.id,title:contact.name,content:record.content,code:record.scoreCode}))
  ]);
}
