import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_GRADES, emptyContact } from '../src/domain/contacts';
import { changeTracking, nextContactDate, undoTracking, needsGradeReview, reviewContactGrade } from '../src/domain/tracking';
import { contactFollowups } from '../src/domain/followups';
import { emptyWorkspace, parseWorkspace } from '../src/domain/workspace';
const contact = {...emptyContact(),id:'c',name:'測試',grade:'A',createdAt:'2026-09-20T00:00:00Z',updatedAt:'2026-09-20T00:00:00Z'};
test('completion creates one record and next followup, persists and undo restores original',()=>{
  const input={id:'op',kind:'complete' as const,date:'2026-09-30',next:'2026-10-07',content:'已完成聯繫',scoreCode:'contact',gradeCode:'A'};
  const done=changeTracking(contact,DEFAULT_GRADES,input);
  assert.equal(nextContactDate(done,DEFAULT_GRADES),'2026-10-07');
  assert.equal(changeTracking(done,DEFAULT_GRADES,input).records?.length,1);
  const persisted=parseWorkspace({...emptyWorkspace(),contacts:[done]}).contacts[0];
  assert.equal(contactFollowups([persisted],DEFAULT_GRADES).length,1);
  const undone=undoTracking(persisted);
  assert.equal(nextContactDate(undone,DEFAULT_GRADES),'2026-09-27');
  assert.equal(undone.records?.length,0);
  assert.equal(undone.trackingHistory?.[0].undone,true);
});
test('rescheduling keeps history, supports undated and archive, and validates completion',()=>{
  const moved=changeTracking(contact,DEFAULT_GRADES,{id:'move',kind:'reschedule',date:'2026-09-30',next:null});
  assert.deepEqual(contactFollowups([moved],DEFAULT_GRADES),[]);
  assert.equal(moved.trackingHistory?.[0].from,'2026-09-27');
  assert.equal(nextContactDate(undoTracking(moved),DEFAULT_GRADES),'2026-09-27');
  assert.deepEqual(contactFollowups([{...contact,archived:true}],DEFAULT_GRADES),[]);
  assert.throws(()=>changeTracking(contact,DEFAULT_GRADES,{id:'bad',kind:'complete',date:'2026-09-30',next:'2026-09-29',content:'內容'}));
  assert.throws(()=>parseWorkspace({...emptyWorkspace(),contacts:[{...contact,nextContactDate:'2026-02-30'}]}));
});

test('each new contact requires explicit regrading, including the same grade',()=>{
  const done=changeTracking(contact,DEFAULT_GRADES,{id:'ungraded',kind:'complete',date:'2026-09-30',next:null,content:'已聯絡'});
  assert.equal(needsGradeReview(done),true);
  assert.equal(nextContactDate(done,DEFAULT_GRADES),null);
  const reviewed=reviewContactGrade(done,'A',DEFAULT_GRADES);
  assert.equal(needsGradeReview(reviewed),false);
  assert.equal(nextContactDate(reviewed,DEFAULT_GRADES),'2026-10-07');
  const again=changeTracking(reviewed,DEFAULT_GRADES,{id:'again',kind:'complete',date:'2026-10-01',next:null,content:'再次聯絡'});
  assert.equal(needsGradeReview(again),true);
  assert.equal(nextContactDate(undoTracking(again),DEFAULT_GRADES),'2026-10-07');
  assert.equal(needsGradeReview({...contact, records:[{id:'legacy',date:'2026-09-20',content:'舊紀錄'}]}),false);
});