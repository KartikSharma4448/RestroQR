'use client';
import { useCallback,useEffect,useRef,useState } from 'react';
import { BellRing,RefreshCw } from 'lucide-react';
interface Call { id:string; status:'pending'|'acknowledged'|'resolved' }
const api=process.env.NEXT_PUBLIC_API_URL || 'https://restroqr-api.onrender.com';
export default function WaiterCall({tableToken}:{tableToken:string}) {
  const [call,setCall]=useState<Call|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const requesting=useRef(false);
  const revision=useRef(0);
  const load=useCallback(async(signal?:AbortSignal)=>{
    const version=++revision.current;
    const response=await fetch(`${api}/api/public/waiter-calls/status`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tableToken}),cache:'no-store',signal});
    const body=await response.json();
    if (!response.ok) throw new Error(body?.error?.message || 'Cannot load waiter request');
    if(version===revision.current)setCall(body.data.call);
  },[tableToken]);
  useEffect(()=>{
    let stopped=false;
    let controller:AbortController|undefined;
    let timer:ReturnType<typeof setTimeout>;
    async function refresh() {
      if(stopped)return;
      if(document.hidden || requesting.current){timer=setTimeout(refresh,10000);return;}
      controller=new AbortController();
      const timeout=setTimeout(()=>controller?.abort(),10000);
      try{await load(controller.signal)}catch(error){if(!stopped)setError(error instanceof Error?error.message:'Cannot refresh waiter request')}
      finally{clearTimeout(timeout);if(!stopped)timer=setTimeout(refresh,10000)}
    }
    void refresh();
    return ()=>{stopped=true;controller?.abort();clearTimeout(timer)};
  },[load]);
  async function send() {
    if(requesting.current)return;
    requesting.current=true;revision.current++;setBusy(true);setError('');
    try {
      const response=await fetch(`${api}/api/public/waiter-calls`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tableToken}),signal:AbortSignal.timeout(15000)});
      const body=await response.json();
      if(!response.ok)throw new Error(body?.error?.message || 'Request failed. Please try again.');
      setCall(body.data.call);
    }catch(error){setError(error instanceof Error?error.message:'Connection failed. Please try again.')}
    finally{requesting.current=false;setBusy(false)}
  }
  const active=call && call.status!=='resolved';
  return <section aria-label="Waiter assistance" className="cafe-assistance">
    <div className="min-w-0 flex-1">
      <h2 className="text-sm font-semibold text-slate-900">At your table</h2>
      <p role="status" className="mt-1 text-sm text-slate-600">{call?.status==='pending'?'Waiter request sent':call?.status==='acknowledged'?'Request acknowledged':call?.status==='resolved'?'Restaurant received your call':'Need a waiter?'}</p>
      {error && <p role="alert" className="mt-2 break-words text-sm text-rose-700">{error}</p>}
    </div>
    <button type="button" disabled={busy || !!active} onClick={()=>void send()} className="cafe-waiter-button">
      {busy?<RefreshCw size={18}/>:<BellRing size={18}/>}{busy?'Sending...':active?'Requested':'Call waiter'}
    </button>
  </section>;
}
