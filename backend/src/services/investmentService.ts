import { randomUUID } from 'crypto';
import pool from '../config/database';
import { NotFoundError, ValidationError } from '../errors';
import { getMonthlySummary } from './earningsService';

export interface InvestmentRecord {
  id: string;
  topic: string;
  amount: string;
  spentOn: string;
}

export interface MonthlyInvestmentReport {
  month: string;
  items: InvestmentRecord[];
  totalInvestment: string;
  totalRevenue: string;
  paidOrders: number;
  netProfit: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const AMOUNT = /^\d{1,9}(?:\.\d{1,2})?$/;

function toCents(value: string): number {
  return Math.round(Number(value) * 100);
}

function formatCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function validateTopic(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 100) {
    throw new ValidationError('Topic is required (at most 100 characters)', [
      { field: 'topic', message: 'Enter a topic of 1 to 100 characters' },
    ]);
  }
  return value.trim();
}

export function validateAmount(value: unknown): string {
  const text = typeof value === 'number' ? String(value) : value;
  if (typeof text !== 'string' || !AMOUNT.test(text.trim()) || toCents(text.trim()) < 1) {
    throw new ValidationError('Price must be greater than 0 with at most 2 decimals', [
      { field: 'amount', message: 'Enter a price greater than 0 with at most 2 decimals' },
    ]);
  }
  return formatCents(toCents(text.trim()));
}

export function validateSpentOn(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ValidationError('Date must be YYYY-MM-DD', [
      { field: 'spentOn', message: 'Date must be YYYY-MM-DD' },
    ]);
  }
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new ValidationError('Date is not valid', [
      { field: 'spentOn', message: 'Date is not valid' },
    ]);
  }
  return value;
}

function monthBounds(month: string): { start: string; end: string } {
  const [year, monthNumber] = month.split('-').map(Number);
  const start = new Date(Date.UTC(year, monthNumber - 1, 1));
  const end = new Date(Date.UTC(year, monthNumber, 1));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

function mapRow(row: Record<string, unknown>): InvestmentRecord {
  return {
    id: row.id as string,
    topic: row.topic as string,
    amount: row.amount as string,
    spentOn: row.spent_on as string,
  };
}

const COLUMNS = `id, topic, amount::text AS amount, to_char(spent_on, 'YYYY-MM-DD') AS spent_on`;

/**
 * The owner's investment list for a month, plus revenue from paid orders and
 * the resulting profit (revenue minus total investment). Month is "YYYY-MM".
 */
export async function getMonthlyReport(
  restaurantId: string,
  month: string,
): Promise<MonthlyInvestmentReport> {
  const { start, end } = monthBounds(month);
  const result = await pool.query(
    `SELECT ${COLUMNS} FROM investments
     WHERE restaurant_id = $1 AND spent_on >= $2 AND spent_on < $3
     ORDER BY spent_on DESC, created_at DESC, id`,
    [restaurantId, start, end],
  );
  const items = result.rows.map(mapRow);
  const investmentCents = items.reduce((sum, item) => sum + toCents(item.amount), 0);
  const revenue = await getMonthlySummary(restaurantId, month);
  const revenueCents = toCents(revenue.totalRevenue);
  return {
    month,
    items,
    totalInvestment: formatCents(investmentCents),
    totalRevenue: formatCents(revenueCents),
    paidOrders: revenue.totalOrders,
    netProfit: formatCents(revenueCents - investmentCents),
  };
}

export async function createInvestment(
  restaurantId: string,
  input: { topic?: unknown; amount?: unknown; spentOn?: unknown },
): Promise<InvestmentRecord> {
  const topic = validateTopic(input.topic);
  const amount = validateAmount(input.amount);
  const spentOn = validateSpentOn(input.spentOn);
  const result = await pool.query(
    `INSERT INTO investments (id, restaurant_id, topic, amount, spent_on)
     VALUES ($1, $2, $3, $4, $5) RETURNING ${COLUMNS}`,
    [randomUUID(), restaurantId, topic, amount, spentOn],
  );
  return mapRow(result.rows[0]);
}

export async function updateInvestment(
  restaurantId: string,
  id: string,
  input: { topic?: unknown; amount?: unknown; spentOn?: unknown },
): Promise<InvestmentRecord> {
  if (!UUID.test(id)) throw new NotFoundError('Investment not found');
  const topic = validateTopic(input.topic);
  const amount = validateAmount(input.amount);
  const spentOn = validateSpentOn(input.spentOn);
  const result = await pool.query(
    `UPDATE investments SET topic = $3, amount = $4, spent_on = $5, updated_at = NOW()
     WHERE id = $1 AND restaurant_id = $2 RETURNING ${COLUMNS}`,
    [id, restaurantId, topic, amount, spentOn],
  );
  if (!result.rows.length) throw new NotFoundError('Investment not found');
  return mapRow(result.rows[0]);
}

export async function deleteInvestment(restaurantId: string, id: string): Promise<void> {
  if (!UUID.test(id)) throw new NotFoundError('Investment not found');
  const result = await pool.query(
    'DELETE FROM investments WHERE id = $1 AND restaurant_id = $2',
    [id, restaurantId],
  );
  if (!result.rowCount) throw new NotFoundError('Investment not found');
}
