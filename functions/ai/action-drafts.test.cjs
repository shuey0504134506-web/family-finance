const {test}=require('node:test');
const assert=require('node:assert/strict');
const {decodeDrafts,canDraftActions}=require('./action-drafts');
test('action creation requires explicit independent user and global grants',()=>{
  assert.equal(canDraftActions(undefined,{actionsEnabled:true}),false);
  assert.equal(canDraftActions({enabled:true},{enabled:true,actionsEnabled:true}),false);
  assert.equal(canDraftActions({actionsEnabled:true},{enabled:true}),false);
  assert.equal(canDraftActions({actionsEnabled:true},{actionsEnabled:false}),false);
  assert.equal(canDraftActions({actionsEnabled:true,enabled:false},{actionsEnabled:true,enabled:false}),true);
});
const categories=[{type:'expense',id:'food'}];
const payments=[{type:'expense',key:'cash'}];
test('supports a mixed list of editable proposals',()=>{
  const rows=decodeDrafts(JSON.stringify([
    {kind:'transaction',type:'expense',amount:350,date:'2026-11-27',categoryId:'food',payment:'cash',currency:'ILS'},
    {kind:'standing',type:'expense',amount:99,categoryId:'food',payment:'cash'},
    {kind:'debt',direction:'owe',amount:50,payment:'cash'},
    {kind:'task',title:'call',remind:'date',remindDate:'2026-12-01'},
    {kind:'shopping',title:'milk'}
  ]),categories,payments);
  assert.deepEqual(rows.map(r=>r.kind),['transaction','standing','debt','task','shopping']);
  assert.equal(rows[0].amountText,'350');
  assert.equal(rows[0].categoryId,'food');
  assert.equal(rows[2].payment,'cash');
});
test('does not accept invented categories, payment keys, or action types',()=>{
  const [row]=decodeDrafts(JSON.stringify([{kind:'transaction',type:'expense',categoryId:'fake',payment:'fake',currency:'BTC'}]),categories,payments);
  assert.equal(row.categoryId,'');assert.equal(row.payment,'');assert.equal(row.currency,'');
  assert.throws(()=>decodeDrafts('[{"kind":"delete"}]',categories,payments));
  assert.throws(()=>decodeDrafts(JSON.stringify(Array(21).fill({kind:'task'})),categories,payments));
});
