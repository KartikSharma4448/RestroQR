'use client';

import { useEffect, useState } from 'react';
import { Radio } from 'lucide-react';
import { apiFetch } from '@/lib/api';

type Status = 'pending' | 'accepted' | 'completed' | 'payment_received' | 'cancelled';
interface BoardOrder { orderRef: string; tableName: string; customerName: string; status: Status }
const labels: Record<Status, string> = {
  pending: 'Pending', accepted: 'Preparing', completed: 'Ready', payment_received: 'Paid', cancelled: 'Cancelled',
};

export default function LiveOrderBoard({ restaurantToken }: { restaurantToken: string }) {
  const [orders, setOrders] = useState<BoardOrder[]>([]);
  const [state, setState] = useState<'loading' | 'connected' | 'error'>('loading');
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController;
    setState('loading');
    setOrders([]);
    async function refresh() {
      if (document.hidden) { timer = setTimeout(refresh, 15000); return; }
      controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      try {
        const response = await apiFetch<{ data: BoardOrder[] }>(
          `/api/public/order-board/${encodeURIComponent(restaurantToken)}`,
          { cache: 'no-store', signal: controller.signal });
        if (!stopped) { setOrders(response.data); setState('connected'); }
      } catch { if (!stopped) setState('error'); }
      finally { clearTimeout(timeout); if (!stopped) timer = setTimeout(refresh, 15000); }
    }
    void refresh();
    return () => { stopped = true; clearTimeout(timer); controller?.abort(); };
  }, [restaurantToken]);

  return <section className="order-board" aria-labelledby="order-board-heading">
    <header className="order-board-header">
      <h2 id="order-board-heading"><Radio size={18} aria-hidden="true" /> Live orders</h2>
      <span role="status">{state === 'connected' ? 'Live' : state === 'loading' ? 'Connecting...' : 'Reconnecting...'}</span>
    </header>
    {state === 'error' ? <p role="status" className="order-board-empty">Order updates unavailable. Retrying shortly.</p>
      : state === 'loading' ? <p className="order-board-empty">Loading orders...</p>
      : orders.length === 0 ? <p className="order-board-empty">No recent orders</p>
      : <div className="order-board-scroll"><table>
        <thead><tr><th scope="col">Order ID</th><th scope="col">Table</th><th scope="col">Customer</th><th scope="col">Status</th></tr></thead>
        <tbody>{orders.map(order => <tr key={order.orderRef}>
          <td className="order-board-ref">{order.orderRef}</td><td>{order.tableName}</td><td>{order.customerName}</td>
          <td><span className={`order-status order-status-${order.status}`}>{labels[order.status] || 'Updating'}</span></td>
        </tr>)}</tbody>
      </table></div>}
  </section>;
}
