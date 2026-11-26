import { useRef, useState } from 'react';
import { CURRENCY_CODES, CURRENCY_NAMES, type CurrencyCode, type Rates } from '../domain/currency';
import { hasManualPair, saveManualRates, tryAutomaticRates } from '../services/historicalRates';
import { Modal } from './Modal';
import { Field } from './Field';

type Request = { date:string; from:CurrencyCode; to:CurrencyCode; general:boolean; resolve:(ok:boolean)=>void };
export function useManualRate(uid:string, offlineOnly:boolean) {
  const [request,setRequest]=useState<Request|null>(null);
  const pending=useRef(false);
  async function ensure(date:string,from:CurrencyCode,to:CurrencyCode,general=false):Promise<boolean>{
    if(!offlineOnly || from===to) return true;
    if(pending.current) return false;
    pending.current=true;
    try {
      if(await tryAutomaticRates(date)) return true;
      if(!general && hasManualPair(uid,date,from,to)) return true;
      return await new Promise<boolean>(resolve=>setRequest({date,from,to,general,resolve}));
    } finally {pending.current=false;}
  }
  const finish=(ok:boolean)=>{request?.resolve(ok);setRequest(null);};
  return {ensure,dialog:request ? <RateDialog key={`${request.date}:${request.from}:${request.to}`} request={request} uid={uid} onDone={finish}/> : null};
}
function RateDialog({request,uid,onDone}:{request:Request;uid:string;onDone:(ok:boolean)=>void}){
  const required=CURRENCY_CODES.filter(c=>c!=='ILS'&&(request.general || c===request.from || c===request.to));
  const [values,setValues]=useState<Partial<Record<CurrencyCode,string>>>({});
  const [error,setError]=useState('');
  function save(){
    const rates:Partial<Rates>={ILS:1};
    for(const code of required){const raw=values[code]?.trim();if(!raw && request.general && code!==request.from && code!==request.to)continue;const n=Number(raw?.replace(',','.'));if(!Number.isFinite(n)||n<=0||n>1e9){setError('יש להזין שער חיובי תקין.');return;}rates[code]=1/n;}
    try{saveManualRates(uid,request.general?'default':request.date,rates);onDone(true);}catch{setError('לא הצלחנו לשמור את השער.');}
  }
  return <Modal title="שער המרה ידני" onClose={()=>onDone(false)}><div className="stack"><p className="muted small">אין שער אוטומטי זמין. הזינו כמה שקלים שווה יחידה אחת של המטבע. {request.general?'השער ישמש הערכה לפעולות ללא שער היסטורי.':`השער יישמר עבור ${request.date}.`}</p>{required.map(code=><Field key={code} label={`1 ${CURRENCY_NAMES[code]} = ₪`} inputMode="decimal" dir="ltr" value={values[code]??''} onChange={e=>setValues(v=>({...v,[code]:e.target.value}))}/>)}{error&&<p role="alert" className="field-error">{error}</p>}<button type="button" className="btn btn-primary" onClick={save}>שמירה</button><button type="button" className="btn btn-secondary" onClick={()=>onDone(false)}>ביטול</button></div></Modal>;
}
