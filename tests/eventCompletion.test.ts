import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyContact} from '../src/domain/contacts';
import {emptyEvent} from '../src/domain/events';
import {emptyWorkspace,parseWorkspace} from '../src/domain/workspace';
import {completeSchedule} from '../src/domain/eventCompletion';
import {nextContactDate,needsGradeReview,undoTracking} from '../src/domain/tracking';
import {openDatabase} from '../server/database';
import {syncRecordScores} from '../server/recordScores';
const initial=()=>({...emptyWorkspace(),contacts:[{...emptyContact(),id:'c',name:'小林',grade:'A',createdAt:'2026-10-01',updatedAt:'2026-10-01'}],events:[{...emptyEvent('e','2026-10-06'),title:'拜訪',contactId:'c'}]});
const input={id:'op',date:'2026-10-06',content:'完成拜訪',scoreCode:'contact',gradeCode:'B',next:'2026-11-06'};
test('event completion saves a linked record and regrades once across retry and reopening', async () => {
  const state=initial(),done=parseWorkspace(completeSchedule(state,state.events[0],input));
  assert.equal(done.events[0].completed,true);assert.equal(done.events[0].recordId,'op');assert.equal(done.contacts[0].records?.length,1);
  assert.equal(nextContactDate(done.contacts[0],done.grades),'2026-11-06');
  const retry=completeSchedule(done,state.events[0],input);assert.equal(retry.contacts[0].records?.length,1);
  const reopened={...done,events:[{...done.events[0],completed:false}]};
  const again=completeSchedule(reopened,reopened.events[0],{...input,id:'different'});assert.equal(again.contacts[0].records?.length,1);assert.equal(again.events[0].recordId,'op');
  assert.throws(()=>completeSchedule(done,{...done.events[0],contactId:'other'},input));
  assert.throws(()=>completeSchedule(state,{...state.events[0],title:''},input));assert.equal(state.contacts[0].records,undefined);
});
test('ungraded completion enters pending; undo allows a fresh explicit record', async () => {
  const state=initial(),done=completeSchedule(state,state.events[0],{...input,gradeCode:'',next:null});
  assert.equal(needsGradeReview(done.contacts[0]),true);assert.equal(nextContactDate(done.contacts[0],done.grades),null);
  const undone={...done,contacts:[undoTracking(done.contacts[0])]};
  const recreated=completeSchedule(undone,undone.events[0],{...input,id:'new-op'});
  assert.equal(recreated.contacts[0].records?.length,1);assert.equal(recreated.events[0].recordId,'new-op');
  assert.throws(()=>completeSchedule({...state,contacts:[{...state.contacts[0],archived:true}]},state.events[0],input));
});
test('linked completion scores only once and record deletion revokes points', async () => {
  const db=openDatabase(':memory:');
  try{
    db.prepare("INSERT INTO users(id,email,password_hash,role,created_at) VALUES('u','event@example.test','test','user','now')").run();
    const state=initial(),done=completeSchedule(state,state.events[0],input);
    await syncRecordScores(db,'u',state,done);await syncRecordScores(db,'u',done,completeSchedule(done,done.events[0],input));
    assert.equal(db.prepare('SELECT count(*) n FROM score_entries').get()!.n,1);
    assert.equal(db.prepare('SELECT points FROM score_entries').get()!.points,1);
    await syncRecordScores(db,'u',done,{...done,contacts:[{...done.contacts[0],records:[]}]});
    assert.equal(db.prepare('SELECT revoked FROM score_entries').get()!.revoked,1);
  }finally{db.close();}
});
