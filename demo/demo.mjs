import { analyze } from './local-analysis.mjs';
const summary = {selectedMonth:'2026-11',monthlySavingsGoal:500,monthlyTotals:[{month:'2026-09',income:12000,expenses:10800},{month:'2026-10',income:12500,expenses:11750},{month:'2026-11',income:13000,expenses:11200}]};
const $ = id => document.getElementById(id);
const storeKey = 'family-finance-fictitious-demo-v1';
let state = { day:'', used:0, messages:[] };
try { const saved=JSON.parse(localStorage.getItem(storeKey)); if(saved && Array.isArray(saved.messages) && Number.isInteger(saved.used)) state=saved; } catch { /* no private storage */ }
const today = new Date().toISOString().slice(0,10);
if (state.day !== today) { state.day=today; state.used=0; }
function persist(){ try { localStorage.setItem(storeKey,JSON.stringify(state)); } catch { /* storage unavailable */ } }
function draw(){
  $('messages').replaceChildren();
  for(const m of state.messages){const el=document.createElement('div'); el.className=m.role==='user'?'message user':'message';el.textContent=m.text;$('messages').append(el);}
  $('messages').scrollTop=$('messages').scrollHeight;
  $('quota').textContent=`נותרו ${Math.max(0,10-state.used)} שאלות היום · 0 פניות חיצוניות`;
}
function totals(){summary.selectedMonth=$('month').value;const r=summary.monthlyTotals.find(x=>x.month===summary.selectedMonth);$('totals').replaceChildren();for(const [label,value] of [['הכנסות',r.income],['הוצאות',r.expenses],['יתרה',r.income-r.expenses]]){const el=document.createElement('div');el.className='metric';el.textContent=`${label}: ₪${value.toLocaleString('he-IL')}`;$('totals').append(el);}}
$('month').addEventListener('change',totals);
$('chat').addEventListener('submit',e=>{e.preventDefault();const q=$('question').value.trim();if(!q||state.used>=10)return;state.used++;state.messages.push({role:'user',text:q},{role:'model',text:analyze(summary,q)});state.messages=state.messages.slice(-40);$('question').value='';persist();draw();});
$('clear').addEventListener('click',()=>{state.messages=[];persist();draw();});
$('validate').addEventListener('click',()=>{$('keyResult').textContent=/^[A-Za-z0-9._~+/=-]{20,400}$/.test($('key').value)?'המבנה תקין. אין אימות מול ספק ואין חיוב.':'המבנה אינו תקין.';$('key').value='';});
totals();draw();
