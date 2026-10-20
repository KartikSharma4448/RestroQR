'use client';
import {useEffect,useState} from 'react';
import {Copy,Gift,Star} from 'lucide-react';
import {apiFetch} from '@/lib/api';
interface Reward {restaurant:string;reward:string;kind:string;status:string;expiresAt:string}
export default function PrivateVisit({kind}:{kind:'reward'|'review'}) {
  const [secret,setSecret]=useState(''),[reward,setReward]=useState<Reward|null>(null),[restaurant,setRestaurant]=useState('');
  const [submitted,setSubmitted]=useState(false),[rating,setRating]=useState(5),[body,setBody]=useState('');
  const [error,setError]=useState(''),[busy,setBusy]=useState(true),[copied,setCopied]=useState(false),[attempt,setAttempt]=useState(0);
  useEffect(()=>{
    const value=window.location.hash.slice(1);setSecret(value);
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);let active=true;
    setBusy(true);setError('');
    const [token,claim]=value.split('.');
    apiFetch<{data:Reward&{submitted:boolean}}>(kind==='reward'?'/api/public/rewards/view':'/api/public/reviews/view',{
      method:'POST',body:JSON.stringify({token,claim}),signal:controller.signal,cache:'no-store',
    }).then(result=>{if(!active)return;if(kind==='reward')setReward(result.data);setRestaurant(result.data.restaurant);setSubmitted(result.data.submitted);})
      .catch(e=>{if(active)setError(e instanceof Error?e.message:'Link unavailable');}).finally(()=>{clearTimeout(timer);if(active)setBusy(false);});
    return()=>{active=false;controller.abort();clearTimeout(timer);};
  },[kind,attempt]);
  async function submit(e:React.FormEvent){
    e.preventDefault();if(busy)return;setBusy(true);setError('');
    try {await apiFetch('/api/public/reviews/submit',{method:'POST',body:JSON.stringify({token:secret,rating,body}),signal:AbortSignal.timeout(15000)});setSubmitted(true);}
    catch(e){setError(e instanceof Error?e.message:'Could not submit review');}finally{setBusy(false);}
  }
  return <main className="mx-auto min-h-screen max-w-xl px-5 py-12">
    <p className="mb-6 text-sm font-semibold text-teal-700">RestroQR</p>
    <h1 className="text-2xl font-bold">{kind==='reward'?'Your visit reward':'Review your visit'}</h1>
    {restaurant&&<p className="mt-2 break-words text-slate-600">{restaurant}</p>}
    {busy&&<p role="status" className="mt-6">Loading...</p>}
    {error&&<div role="alert" className="mt-5 text-red-700"><p>{error}</p><button type="button" disabled={busy} className="mt-2 underline" onClick={()=>setAttempt(a=>a+1)}>Retry</button></div>}
    {kind==='reward'&&reward&&<section className="mt-6 border-y border-slate-200 py-6">
      <Gift size={32} className="text-teal-700"/><h2 className="mt-4 break-words text-xl font-semibold">{reward.reward}</h2>
      <p className="mt-2 capitalize">{reward.status}</p><p className="mt-1 text-sm text-slate-500">Expires {new Date(reward.expiresAt).toLocaleDateString()}</p>
      {reward.status==='available'&&<div className="mt-5"><p className="text-sm font-semibold">Private claim code</p><code className="mt-2 block break-all rounded border border-slate-200 p-3 text-sm">{secret.split('.')[1]}</code>
        <button type="button" onClick={async()=>{try{await navigator.clipboard.writeText(secret.split('.')[1]);setCopied(true);}catch{setError('Clipboard unavailable');}}} className="mt-3 flex items-center gap-2 rounded-md bg-teal-700 px-4 py-3 text-white"><Copy size={16}/>{copied?'Copied':'Copy claim code'}</button></div>}
    </section>}
    {kind==='review'&&restaurant&&(submitted?<p role="status" className="mt-6 rounded-md bg-teal-50 p-4 text-teal-900">Thank you. Your review has been submitted for moderation.</p>:<form onSubmit={submit} className="mt-6 space-y-5">
      <fieldset disabled={busy}><legend className="mb-2 font-semibold">Rating</legend><div className="flex gap-2">{[1,2,3,4,5].map(n=><button type="button" key={n} aria-label={`${n} stars`} aria-pressed={rating===n} onClick={()=>setRating(n)} className="p-2"><Star size={28} className={n<=rating?'fill-amber-400 text-amber-500':'text-slate-400'}/></button>)}</div></fieldset>
      <label className="block font-semibold">Your review<textarea maxLength={1000} value={body} onChange={e=>setBody(e.target.value)} className="mt-2 block min-h-32 w-full rounded-md border border-slate-300 p-3 font-normal"/></label>
      <button disabled={busy} className="rounded-md bg-teal-700 px-6 py-3 font-semibold text-white disabled:opacity-50">Submit review</button>
    </form>)}
  </main>;
}
