'use client';

import { useCallback, useEffect, useState } from 'react';
import { Banknote, Check, ExternalLink, RefreshCw, Smartphone, Upload } from 'lucide-react';

export interface PaymentAccess { orderId: string; token: string }
interface PaymentDetails {
  orderRef: string; total: string; payeeName: string; upiId: string | null;
  choice: string; orderStatus: string; transactionId: string | null;
  upiUrl: string | null; qrDataUrl: string | null;
}
const api = process.env.NEXT_PUBLIC_API_URL || 'https://restroqr-api.onrender.com';

export default function OrderPayment({ access }: { access: PaymentAccess }) {
  const [details,setDetails] = useState<PaymentDetails | null>(null);
  const [mode,setMode] = useState('upi');
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);
  const [transactionId,setTransactionId] = useState('');
  const [file,setFile] = useState<File | null>(null);
  const [loading,setLoading] = useState(true);
  const load = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch(`${api}/api/public/order-payments/${access.orderId}`, {
      headers: { 'X-Order-Token': access.token }, cache: 'no-store', signal,
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body?.error?.message || 'Payment details are unavailable. Contact the restaurant.');
    setDetails(body.data);
  },[access.orderId,access.token]);
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal).catch(error => { if (!controller.signal.aborted) setError(error.message); }).finally(() => setLoading(false));
    return () => controller.abort();
  },[load]);
  async function submit(choice: 'cash' | 'proof') {
    if (busy) return;
    setError('');
    if (choice === 'proof' && (!file || file.size > 2*1024*1024 || !['image/jpeg','image/png','image/webp'].includes(file.type))) {
      setError('Choose a JPEG, PNG or WebP screenshot up to 2MB.'); return;
    }
    setBusy(true);
    try {
      const data = new FormData();
      if (choice === 'proof') { data.append('transactionId',transactionId.trim()); data.append('image',file!); }
      const response = await fetch(`${api}/api/public/order-payments/${access.orderId}/${choice}`, {
        method: 'POST', headers: { 'X-Order-Token': access.token }, ...(choice === 'proof' ? { body: data } : {}),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error?.message || 'Could not save payment details. Please try again.');
      setDetails(current => current ? { ...current, choice: result.data.choice,
        ...(choice === 'proof' ? { transactionId: transactionId.trim() } : {}) } : current);
      await load();
    } catch (error) { setError(error instanceof Error ? error.message : 'Connection failed. Please try again.'); }
    finally { setBusy(false); }
  }
  return <section aria-label="Order payment" className="mt-5 border-t border-slate-200 pt-5 text-sm text-slate-800">
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-base font-semibold">Payment</h3>
      <button type="button" title="Refresh payment status" aria-label="Refresh payment status" disabled={busy || loading}
        onClick={async () => { setLoading(true); setError(''); try { await load(); } catch (error) { setError(error instanceof Error ? error.message : 'Unable to refresh'); } finally { setLoading(false); } }}
        className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 disabled:opacity-50"><RefreshCw size={16}/></button>
    </div>
    {error && <p role="alert" className="my-3 break-words text-rose-700">{error}</p>}
    {loading && <p role="status" className="py-3">Loading payment details...</p>}
    {details && <>
      {details.orderStatus === 'payment_received' ? <p role="status" className="mt-3 flex items-center gap-2 text-emerald-700"><Check size={18}/>Payment confirmed by restaurant</p>
        : details.orderStatus === 'cancelled' ? <p role="status" className="mt-3">Order cancelled. Do not pay. Contact the restaurant about any prior payment.</p>
        : details.choice === 'upi_submitted' ? <div className="mt-3 space-y-2"><p role="status" className="font-semibold">Proof submitted · Awaiting restaurant confirmation</p><p className="break-all">Transaction ID: {details.transactionId}</p></div>
        : <>
          <div className="my-3 flex gap-2" role="group" aria-label="Payment method">
            {details.upiUrl && <button type="button" aria-pressed={mode === 'upi'} disabled={busy} onClick={() => setMode('upi')}
              className={`flex flex-1 items-center justify-center gap-2 rounded-md border px-3 py-2.5 ${mode === 'upi' ? 'border-teal-700 bg-teal-50' : 'border-slate-300'}`}><Smartphone size={18}/>UPI</button>}
            <button type="button" aria-pressed={mode === 'cash' || !details.upiUrl} disabled={busy} onClick={() => setMode('cash')}
              className={`flex flex-1 items-center justify-center gap-2 rounded-md border px-3 py-2.5 ${mode === 'cash' || !details.upiUrl ? 'border-teal-700 bg-teal-50' : 'border-slate-300'}`}><Banknote size={18}/>Cash</button>
          </div>
          {mode === 'upi' && details.upiUrl ? <>
            <p className="break-words font-semibold">{details.payeeName}</p><p className="mt-1 break-all text-slate-600">{details.upiId}</p>
            <p className="mt-2 font-semibold">INR {details.total}</p>
            {details.qrDataUrl && <img src={details.qrDataUrl} alt="UPI payment QR" width={180} height={180} className="mx-auto my-3 aspect-square"/>}
            <a href={details.upiUrl} className="flex items-center justify-center gap-2 rounded-md bg-teal-700 px-3 py-3 font-semibold text-white"><ExternalLink size={18}/>Open UPI app</a>
            <form onSubmit={event => { event.preventDefault(); void submit('proof'); }} className="mt-4 space-y-3">
              <label className="block font-medium" htmlFor="payment-transaction">Transaction ID</label>
              <input id="payment-transaction" required pattern="[A-Za-z0-9]{8,64}" minLength={8} maxLength={64} value={transactionId} disabled={busy}
                onChange={event => setTransactionId(event.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-base"/>
              <label className="block font-medium" htmlFor="payment-screenshot">Payment screenshot</label>
              <input id="payment-screenshot" type="file" required accept="image/jpeg,image/png,image/webp" disabled={busy}
                onChange={event => setFile(event.target.files?.[0] || null)} className="block w-full min-w-0 text-sm"/>
              <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-md bg-slate-900 px-3 py-3 font-semibold text-white disabled:opacity-50"><Upload size={18}/>{busy ? 'Submitting...' : 'Submit payment proof'}</button>
            </form>
          </> : <div className="space-y-3">
            <p>{details.choice === 'cash' ? 'Cash selected. Awaiting payment confirmation at the counter.' : 'Pay at the restaurant counter.'}</p>
            <button type="button" disabled={busy || details.choice === 'cash'} onClick={() => void submit('cash')}
              className="w-full rounded-md bg-slate-900 px-3 py-3 font-semibold text-white disabled:opacity-50">{details.choice === 'cash' ? 'Cash selected' : busy ? 'Saving...' : 'Choose cash'}</button>
          </div>}
        </>}
    </>}
  </section>;
}
