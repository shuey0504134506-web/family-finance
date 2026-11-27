import { useState, useRef, useCallback, useEffect } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app, db } from '../../firebase/config';
import { doc, writeBatch } from 'firebase/firestore';
import { Modal } from '../../components/Modal';
import { getLang } from '../../i18n/lang';
import { tr } from '../../i18n/translate';
import { todayIso } from '../../domain/dates';
import { CURRENCY_CODES, getCurrency, isCurrencyCode } from '../../domain/currency';
import { choicesFor, choiceKey, choiceText, parseChoiceKey } from '../../domain/payment';
import { buildTransaction, validateDraft, type TransactionDraft } from '../../domain/transactionInput';
import { inSpace, type Space } from '../../domain/spaces';
import { useSpace } from '../spaces/SpaceRoute';
import { useReadyAuth } from '../auth/AuthContext';
import { useCategories } from '../../hooks/useCategories';
import type { Category, TransactionType } from '../../domain/types';
import { useCustomMethods } from '../../hooks/useCustomMethods';
import { newId } from '../../services/ids';
import { transactionsCollection } from '../../services/transactionService';
import { buildTask, buildShoppingItem, validateTaskDraft, validateItemName, REMIND_LABELS, type RemindMode } from '../../domain/tasks';
import { validateDebt, DEFAULT_DEBT_CATEGORIES, type Debt } from '../../domain/debt';
import { parseShekelsToAgorot } from '../../domain/money';
import { orderFromTransaction } from '../../domain/standingOrder';
import { describeAiError, AI_SUPPORTED, useAiAccess } from '../../services/aiService';

type Proposal = {kind: 'transaction'|'standing'|'task'|'shopping'|'debt';type: TransactionType; amountText: string; date: string; currency: string; counterparty: string; note: string; categoryId: string; payment: string; title:string; remind:RemindMode; remindDate:string; direction:'owe'|'owed'|''; dueDate:string; debtCategory:string};
type Row = Proposal & {id: string; createdAt:number; titheStatus: TransactionDraft['titheStatus']; isTithePayment: boolean};
type Speech = {lang:string; onresult:null|((e:{results:ArrayLike<ArrayLike<{transcript:string}>>})=>void); onerror:null|(()=>void); onend:null|(()=>void); start():void; abort():void};
type SpeechConstructor = new()=>Speech;

export function AiActionEntryButton(){
  const {user}=useReadyAuth();
  const space=useSpace();
  const allowed=useAiAccess(user.uid,(user as {offlineOnly?:boolean}).offlineOnly===true);
  const {categories,loading}=useCategories(user.uid);
  const [open,setOpen]=useState(false);
  if(!AI_SUPPORTED||!allowed)return null;
  return <><button type="button" className="btn btn-primary" disabled={loading} onClick={()=>setOpen(true)}>✦ יצירת פעולות באמצעות AI</button>{open&&<AiActionEntry uid={user.uid} space={space} categories={categories} onClose={()=>setOpen(false)} onSaved={()=>setOpen(false)}/>}</>;
}

export function AiActionEntry({uid, space, categories, onClose, onSaved}: {uid:string;space:Space;categories:Category[];onClose:()=>void;onSaved:()=>void}) {
  const [text,setText]=useState('');
  const [rows,setRows]=useState<Row[]>([]);
  const [busy,setBusy]=useState(false);
  const [consent,setConsent]=useState(false);
  const [speechConsent,setSpeechConsent]=useState(false);
  const [listening,setListening]=useState(false);
  const [error,setError]=useState('');
  const [saving,setSaving]=useState(false);
  const lock=useRef(false);
  const speech=useRef<Speech|null>(null);
  const recorder=useRef<MediaRecorder|null>(null);
  const stream=useRef<MediaStream|null>(null);
  const timer=useRef<number>();
  const [audioConsent,setAudioConsent]=useState(false);
  const methods=useCustomMethods(uid);
  const available=categories.filter(c=>c.active&&inSpace(c,space));
  const types=['income','expense'] as const;
  const payments=types.flatMap(type=>choicesFor(type,methods[type]).map(choice=>({type,key:choiceKey(choice),name:choiceText(choice)})));
  const browser=window as unknown as {SpeechRecognition?:SpeechConstructor;webkitSpeechRecognition?:SpeechConstructor};
  const SpeechApi=browser.SpeechRecognition??browser.webkitSpeechRecognition;
  useEffect(()=>()=>{speech.current?.abort();window.clearTimeout(timer.current);if(recorder.current&&recorder.current.state!=='inactive'){recorder.current.onstop=null;recorder.current.stop();}stream.current?.getTracks().forEach(t=>t.stop());},[]);
  const onCloseRef=useRef(onClose);
  onCloseRef.current=onClose;
  const close=useCallback(()=>{if(!lock.current)onCloseRef.current();},[]);
  function dictate(){
    if(!SpeechApi||!speechConsent||listening)return;
    const recognition=new SpeechApi();
    speech.current=recognition;
    recognition.lang=getLang()==='en'?'en-US':'he-IL';
    recognition.onresult=e=>{const transcript=Array.from(e.results).map(r=>r[0]?.transcript??'').join(' ');setText(previous=>[previous,transcript].filter(Boolean).join(' ').slice(0,3000));};
    recognition.onerror=()=>{setError(tr('ההכתבה נכשלה'));setListening(false);};
    recognition.onend=()=>setListening(false);
    try{setListening(true);recognition.start();}catch{setListening(false);setError(tr('ההכתבה נכשלה'));}
  }
  async function record(){
    if(!audioConsent||busy||!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined')return;
    if(recorder.current?.state==='recording'){recorder.current.stop();return;}
    if(lock.current)return;
    lock.current=true;setError('');
    try{
      const media=await navigator.mediaDevices.getUserMedia({audio:true,video:false});
      stream.current=media;
      const mime=['audio/webm','audio/mp4','audio/ogg'].find(x=>MediaRecorder.isTypeSupported(x));
      if(!mime)throw Error('unsupported');
      const rec=new MediaRecorder(media,{mimeType:mime});
      recorder.current=rec;
      const chunks:Blob[]=[];
      rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
      rec.onstop=async()=>{
        window.clearTimeout(timer.current);media.getTracks().forEach(t=>t.stop());setListening(false);setBusy(true);
        try{
          const blob=new Blob(chunks,{type:mime});
          if(!blob.size||blob.size>1200000)throw Error('size');
          const encoded=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=reject;reader.readAsDataURL(blob);});
          const call=httpsCallable<unknown,{text:string}>(getFunctions(app,'europe-west1'),'aiTranscribeAction',{timeout:60000});
          const result=await call({audio:encoded,mime,lang:getLang(),consent:true});
          setText(previous=>[previous,result.data.text].filter(Boolean).join(' ').slice(0,3000));
        }catch(e){setError(describeAiError(e));}finally{lock.current=false;setBusy(false);}
      };
      rec.start();setListening(true);timer.current=window.setTimeout(()=>{if(rec.state==='recording')rec.stop();},30000);
    }catch{stream.current?.getTracks().forEach(t=>t.stop());lock.current=false;setListening(false);setError(tr('ההכתבה נכשלה'));}
  }
  async function generate(){
    if(lock.current||!consent||!text.trim())return;
    lock.current=true;setBusy(true);setError('');
    try{
      const call=httpsCallable<unknown,{drafts:(Partial<Proposal>&Pick<Proposal,'kind'>)[]}>(getFunctions(app,'europe-west1'),'aiDraftActions',{timeout:125000});
      const result=await call({text:text.trim(),date:todayIso(),currency:getCurrency(),categories:available.map(({id,name,type})=>({id,name,type})),payments,consent:true});
      setRows(result.data.drafts.map(row=>({type:'expense',amountText:'',date:'',currency:'',counterparty:'',note:'',categoryId:'',payment:'',title:'',remind:'none',remindDate:'',direction:'',dueDate:'',debtCategory:'',...row,id:newId(),createdAt:Date.now(),titheStatus:'liable',isTithePayment:false})));
      if(!result.data.drafts.length)setError(tr('לא זוהו פעולות. יש להוסיף פרטים.'));
    }catch(e){setError(describeAiError(e));}finally{lock.current=false;setBusy(false);}
  }
  const update=(id:string,patch:Partial<Row>)=>setRows(previous=>previous.map(row=>row.id===id?{...row,...patch}:row));
  const draftOf=(row:Row):TransactionDraft=>({
    type:row.type,amountText:row.amountText,date:row.date,counterparty:row.counterparty,categoryId:row.categoryId,
    paymentMethod:parseChoiceKey(row.payment).method,paymentLabel:parseChoiceKey(row.payment).label??'',note:row.note,titheStatus:row.titheStatus,isTithePayment:row.isTithePayment,
    currency:row.currency as TransactionDraft['currency'],
  });
  const valid=(row:Row)=>{
    if(row.kind==='task')return Object.keys(validateTaskDraft({title:row.title,remind:row.remind,remindDate:row.remindDate})).length===0;
    if(row.kind==='shopping')return !validateItemName(row.title);
    if(row.kind==='debt')return !!row.direction&&isCurrencyCode(row.currency)&&payments.some(p=>p.type==='expense'&&p.key===row.payment)&&Object.keys(validateDebt({name:row.counterparty,amountAgorot:parseShekelsToAgorot(row.amountText),category:row.debtCategory,date:row.date,dueDate:row.dueDate,note:row.note})).length===0;
    return isCurrencyCode(row.currency)&&payments.some(p=>p.type===row.type&&p.key===row.payment)&&Object.keys(validateDraft(draftOf(row),available.filter(c=>c.type===row.type).map(c=>c.id))).length===0;
  };
  async function save(){
    if(lock.current||!rows.length||!rows.every(valid))return;
    lock.current=true;setSaving(true);setError('');
    try{
      const now=Date.now();
      const batch=writeBatch(db);
      for(const row of rows){
        const context={id:row.id,scope:space.scope,businessId:space.businessId,now,createdAt:row.createdAt};
        if(row.kind==='task'){batch.set(doc(db,'users',uid,'tasks',row.id),buildTask({title:row.title,remind:row.remind,remindDate:row.remindDate},context));continue;}
        if(row.kind==='shopping'){batch.set(doc(db,'users',uid,'shoppingItems',row.id),buildShoppingItem(row.title,context));continue;}
        if(row.kind==='debt'){
          const payment=parseChoiceKey(row.payment);
          const debt:Debt={id:row.id,scope:space.scope,...(space.businessId?{businessId:space.businessId}:{}),direction:row.direction as Debt['direction'],name:row.counterparty.trim(),amountAgorot:parseShekelsToAgorot(row.amountText)!,currency:row.currency as Debt['currency'],category:row.debtCategory.trim(),paymentMethod:payment.method,...(payment.label?{paymentLabel:payment.label}:{}),date:row.date,...(row.dueDate?{dueDate:row.dueDate}:{}),note:row.note.trim(),payments:[],createdAt:row.createdAt,updatedAt:now};
          batch.set(doc(db,'users',uid,'debts',row.id),debt);continue;
        }
        const tx=buildTransaction(draftOf(row),{...context,categoryName:available.find(c=>c.id===row.categoryId)!.name});
        if(row.kind==='standing'){
          const order=orderFromTransaction(tx,space.scope,{id:row.id,now,today:todayIso()});
          order.nextDue=row.date;
          order.createdAt=row.createdAt;
          batch.set(doc(db,'users',uid,'standingOrders',row.id),order);
        } else batch.set(doc(transactionsCollection(uid,space.scope),row.id),tx);
      }
      await batch.commit();
      onSaved();
    }catch{setError(tr('לא הצלחנו לשמור את הפעולות. ניתן לנסות שוב.'));}finally{lock.current=false;setSaving(false);}
  }
  return <Modal title={tr('יצירת פעולות באמצעות AI')} onClose={close}><div className="stack ai-action-entry">
    <label className="field-label">{tr('תאר את הפעולות')}<textarea className="input" rows={3} maxLength={3000} disabled={busy||saving||rows.length>0} value={text} onChange={e=>setText(e.target.value)} placeholder={tr('קניתי בסופר ב-350 שקל באשראי')}/></label>
    {!rows.length&&<>
      <label><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/> {tr('אני מסכים לשלוח את התיאור, הקטגוריות וצורות התשלום לספקי AI שהוגדרו')}</label>
      {typeof MediaRecorder!=='undefined'&&navigator.mediaDevices&&<><label><input type="checkbox" checked={audioConsent} onChange={e=>setAudioConsent(e.target.checked)}/> {tr('אני מסכים לשלוח הקלטה ל-Groq לתמלול')}</label><button type="button" className="btn btn-secondary" disabled={!audioConsent||busy||(listening&&recorder.current?.state!=='recording')} onClick={()=>void record()}>{recorder.current?.state==='recording'?tr('הפסקת הקלטה'):tr('הקלטה קולית')}</button></>}
      {SpeechApi&&<><label><input type="checkbox" checked={speechConsent} onChange={e=>setSpeechConsent(e.target.checked)}/> {tr('אני מסכים שההכתבה עשויה להישלח לשירות זיהוי הדיבור של המכשיר')}</label><button type="button" className="btn btn-secondary" disabled={!speechConsent||busy||recorder.current?.state==='recording'} onClick={()=>listening?speech.current?.abort():dictate()}>{listening?tr('הפסקת הקלטה'):tr('הכתבה קולית')}</button></>}
          <button type="button" className="btn btn-primary" disabled={!consent||busy||listening||!text.trim()} onClick={()=>void generate()}>{busy?tr('מכין פעולות…'):tr('זיהוי פעולות')}</button>
    </>}
    {rows.map((row,i)=><fieldset key={row.id} className="card stack" disabled={saving}>
      <legend>{tr(({transaction:'פעולה',standing:'הוראת קבע',task:'משימה',shopping:'פריט קנייה',debt:'חוב'})[row.kind])} {i+1}</legend>
      {(row.kind==='task'||row.kind==='shopping')?<><label>תיאור<input className="input" value={row.title} maxLength={row.kind==='task'?200:120} onChange={e=>update(row.id,{title:e.target.value})}/></label>{row.kind==='task'&&<><label>תזכורת<select className="input" value={row.remind} onChange={e=>update(row.id,{remind:e.target.value as RemindMode})}>{Object.entries(REMIND_LABELS).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>{row.remind==='date'&&<label>תאריך<input className="input" type="date" value={row.remindDate} onChange={e=>update(row.id,{remindDate:e.target.value})}/></label>}</>}</>:<>
      {row.kind==='debt'?<label>כיוון החוב<select className="input" value={row.direction} onChange={e=>update(row.id,{direction:e.target.value as Row['direction']})}><option value="">בחר כיוון</option><option value="owe">אני חייב</option><option value="owed">חייבים לי</option></select></label>:<label>{tr('סוג פעולה')}<select className="input" value={row.type} onChange={e=>update(row.id,{type:e.target.value as TransactionType,categoryId:'',payment:''})}><option value="expense">הוצאה</option><option value="income">הכנסה</option></select></label>}
      <label>סכום<input className="input" inputMode="decimal" value={row.amountText} onChange={e=>update(row.id,{amountText:e.target.value})}/></label>
      <label>מטבע<select className="input" value={row.currency} onChange={e=>update(row.id,{currency:e.target.value})}><option value="">בחר מטבע</option>{CURRENCY_CODES.map(c=><option key={c}>{c}</option>)}</select></label>
      <label>תאריך<input className="input" type="date" value={row.date} onChange={e=>update(row.id,{date:e.target.value})}/></label>
      <label>שם<input className="input" value={row.counterparty} maxLength={120} onChange={e=>update(row.id,{counterparty:e.target.value})}/></label>
      {row.kind==='debt'?<><label>קטגוריה<input className="input" list="ai-debt-categories" maxLength={40} value={row.debtCategory} onChange={e=>update(row.id,{debtCategory:e.target.value})}/><datalist id="ai-debt-categories">{DEFAULT_DEBT_CATEGORIES.map(c=><option key={c} value={c}/>)}</datalist></label><label>תאריך יעד<input className="input" type="date" value={row.dueDate} onChange={e=>update(row.id,{dueDate:e.target.value})}/></label></>:<label>קטגוריה<select className="input" value={row.categoryId} onChange={e=>update(row.id,{categoryId:e.target.value})}><option value="">בחר קטגוריה</option>{available.filter(c=>c.type===row.type).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
      <label>אמצעי תשלום<select className="input" value={row.payment} onChange={e=>update(row.id,{payment:e.target.value})}><option value="">בחר אמצעי תשלום</option>{payments.filter(p=>p.type===(row.kind==='debt'?'expense':row.type)).map(p=><option key={p.key} value={p.key}>{p.name}</option>)}</select></label>
      <label>הערה<input className="input" value={row.note} maxLength={1000} onChange={e=>update(row.id,{note:e.target.value})}/></label>
      {row.kind!=='debt'&&(row.type==='income'?<label>מעשרות<select className="input" value={row.titheStatus} onChange={e=>update(row.id,{titheStatus:e.target.value as Row['titheStatus']})}><option value="liable">חייב במעשר</option><option value="exempt">פטור ממעשר</option></select></label>:<label><input type="checkbox" checked={row.isTithePayment} onChange={e=>update(row.id,{isTithePayment:e.target.checked})}/> תשלום מעשר</label>)}
      {row.kind==='standing'&&<p className="small">הפעולה תחזור אוטומטית מדי חודש החל מהתאריך שנבחר.</p>}
      </>}
      <button type="button" className="btn btn-secondary" onClick={()=>setRows(previous=>previous.filter(r=>r.id!==row.id))}>הסרה</button>
      {!valid(row)&&<p className="muted small">יש להשלים את פרטי הפעולה.</p>}
    </fieldset>)}
    {rows.length>0&&<><p className="small">בדוק את כל הפרטים לפני השמירה.</p><button type="button" className="btn btn-primary" disabled={saving||!rows.every(valid)} onClick={()=>void save()}>{saving?'שומר…':'אישור ושמירת הפעולות'}</button><button type="button" className="btn btn-secondary" disabled={saving} onClick={()=>setRows([])}>עריכת התיאור</button></>}
    {error&&<p role="alert" className="field-error">{error}</p>}
    <button type="button" className="btn btn-secondary" disabled={busy||saving} onClick={close}>ביטול</button>
  </div></Modal>;
}
