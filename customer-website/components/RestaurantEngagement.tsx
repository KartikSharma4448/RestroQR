'use client';

import { useEffect, useState } from 'react';
import {
  ArrowDown,
  Gift,
  Star,
  QrCode,
  X,
  RefreshCw,
  Radio,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import LiveOrderBoard from './LiveOrderBoard';

interface Engagement {
  loyalty: null | {
    scheme: string;
    visitReward: string;
    spendReward: string;
    thresholdCents: number;
  };
  reviewsEnabled: boolean;
  reviews: { rating: number; body: string; submitted_at: string }[];
  summary: { count: number; average: string | null };
  payment: null | { upiId: string; url: string; qr: string };
}
export default function RestaurantEngagement({
  token,
  ordering,
}: {
  token: string;
  ordering: boolean;
}) {
  const [data, setData] = useState<Engagement | null>(null),
    [view, setView] = useState<'reviews' | 'pay' | 'orders' | null>(null);
  const [error, setError] = useState(false),
    [loading, setLoading] = useState(true),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let active = true;
    setLoading(true);
    setError(false);
    apiFetch<{ data: Engagement }>(
      `/api/public/engagement/${encodeURIComponent(token)}`,
      { signal: controller.signal, cache: 'no-store' },
    )
      .then((result) => {
        if (active) setData(result.data);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        clearTimeout(timeout);
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
      clearTimeout(timeout);
    };
  }, [token, attempt]);
  return (
    <section aria-label="Restaurant services" className="restaurant-services">
      <div className="cafe-actions">
        <a
          href="#menu"
          onClick={() => setView(null)}
          className="cafe-action cafe-action-primary"
        >
          <ArrowDown size={20} />
          <span>{ordering ? 'Order food' : 'Menu'}</span>
        </a>
        <button
          type="button"
          aria-label="Reviews"
          disabled={!data?.reviewsEnabled}
          onClick={() => setView(view === 'reviews' ? null : 'reviews')}
          className="cafe-action"
          aria-expanded={view === 'reviews'}
          aria-controls="restaurant-service-panel"
        >
          <Star size={20} />
          <span>Reviews</span>
          {!!data?.summary.count && (
            <small aria-hidden="true">{data.summary.average}</small>
          )}
        </button>
        <button
          type="button"
          disabled={!data?.payment}
          onClick={() => setView(view === 'pay' ? null : 'pay')}
          className="cafe-action"
          aria-expanded={view === 'pay'}
          aria-controls="restaurant-service-panel"
        >
          <QrCode size={20} />
          <span>Pay</span>
        </button>
        <button
          type="button"
          onClick={() => setView(view === 'orders' ? null : 'orders')}
          className="cafe-action"
          aria-expanded={view === 'orders'}
          aria-controls="restaurant-service-panel"
        >
          <Radio size={20} />
          <span>Live orders</span>
        </button>
      </div>
      {loading && (
        <p role="status" className="mt-3 text-sm text-slate-500">
          Loading restaurant services...
        </p>
      )}
      {error && (
        <button
          type="button"
          onClick={() => setAttempt((a) => a + 1)}
          className="mt-3 flex items-center gap-2 text-sm text-red-700"
        >
          <RefreshCw size={16} />
          Services unavailable. Retry
        </button>
      )}
      {data?.loyalty && (
        <div className="cafe-reward-strip">
          <Gift size={22} />
          <div>
            <h2 className="font-semibold">Visit rewards</h2>
            {data.loyalty.scheme !== 'spend' && (
              <p className="mt-1">
                7 paid visit dates: {data.loyalty.visitReward}
              </p>
            )}
            {data.loyalty.scheme !== 'visits' && (
              <p className="mt-1">
                Daily paid spend INR{' '}
                {(data.loyalty.thresholdCents / 100).toFixed(2)}:{' '}
                {data.loyalty.spendReward}
              </p>
            )}
          </div>
        </div>
      )}
      {view && (
        <div id="restaurant-service-panel" className="cafe-service-panel">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {view === 'reviews'
                ? 'Guest reviews'
                : view === 'orders'
                  ? 'Restaurant orders'
                  : 'Restaurant payment'}
            </h2>
            <button
              type="button"
              aria-label="Close"
              title="Close"
              onClick={() => setView(null)}
              className="p-2"
            >
              <X size={20} />
            </button>
          </div>
          {view === 'orders' && <LiveOrderBoard restaurantToken={token} />}
          {view === 'reviews' && (
            <>
              <p className="mb-3 text-sm text-slate-600">
                {data?.summary.count
                  ? `${data.summary.average}/5 · ${data.summary.count} published reviews`
                  : 'No published reviews yet'}
              </p>
              <p className="mb-3 text-sm text-slate-600">
                Paid-visit review invitations are included in payment receipts.
              </p>
              <ul className="divide-y divide-slate-100">
                {data?.reviews.map((r, index) => (
                  <li key={index} className="py-3">
                    <p className="flex items-center gap-1 font-semibold">
                      <Star size={15} className="text-amber-500" />
                      {r.rating}/5{' '}
                      <span className="ml-auto text-xs font-normal text-slate-500">
                        {new Date(r.submitted_at).toLocaleDateString()}
                      </span>
                    </p>
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm">
                      {r.body}
                    </p>
                  </li>
                ))}
              </ul>
            </>
          )}
          {view === 'pay' && data?.payment && (
            <div className="flex flex-col items-center gap-3 text-center">
              {/* The image is a server-generated data URL, not an external tracking resource. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={data.payment.qr}
                alt="Restaurant UPI payment QR"
                width={280}
                height={280}
                className="max-w-full"
              />
              <p className="max-w-full break-all text-sm font-semibold">
                {data.payment.upiId}
              </p>
              <p className="text-sm text-slate-600">
                Restaurant QR · Amount not set · Payment confirmation pending
                owner review
              </p>
              <a
                href={data.payment.url}
                className="rounded-md bg-teal-700 px-6 py-3 font-semibold text-white"
              >
                Open UPI app
              </a>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
