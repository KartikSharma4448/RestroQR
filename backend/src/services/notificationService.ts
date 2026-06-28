import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getMessaging, Message } from 'firebase-admin/messaging';
import { applicationDefault } from 'firebase-admin/app';
import pool from '../config/database';

// Initialize Firebase Admin SDK if not already initialized
let app: App;
if (getApps().length === 0) {
  app = initializeApp({
    credential: applicationDefault(),
  });
} else {
  app = getApps()[0];
}

/**
 * Registers (upserts) an FCM device token for an owner.
 * If the owner already has a token registered, it is updated.
 * Uses delete-then-insert to handle upsert since owner_id may not have a unique index.
 */
export async function registerFcmToken(
  ownerId: string,
  fcmToken: string
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM fcm_tokens WHERE owner_id = $1', [ownerId]);
    await client.query(
      `INSERT INTO fcm_tokens (owner_id, token) VALUES ($1, $2)`,
      [ownerId, fcmToken]
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Unregisters (deletes) the FCM device token for an owner.
 */
export async function unregisterFcmToken(ownerId: string): Promise<void> {
  await pool.query('DELETE FROM fcm_tokens WHERE owner_id = $1', [ownerId]);
}

/**
 * Sends an FCM push notification to the restaurant owner when a new order is placed.
 * Looks up the owner's FCM token via the restaurant, sends a push with table name and total.
 * If no token is registered or FCM delivery fails, errors are logged without blocking.
 */
export async function sendOrderNotification(
  restaurantId: string,
  tableName: string,
  orderTotal: string
): Promise<void> {
  try {
    // Look up the owner's FCM token via the restaurant
    const result = await pool.query(
      `SELECT ft.token
       FROM fcm_tokens ft
       JOIN restaurants r ON r.owner_id = ft.owner_id
       WHERE r.id = $1`,
      [restaurantId]
    );

    if (result.rows.length === 0) {
      // Owner has no registered token — skip silently
      return;
    }

    const fcmToken = result.rows[0].token as string;

    const message: Message = {
      token: fcmToken,
      notification: {
        title: 'New Order Received',
        body: `Table: ${tableName} — Total: ₹${orderTotal}`,
      },
      data: {
        tableName,
        orderTotal,
      },
    };

    await getMessaging(app).send(message);
  } catch (error) {
    // Log FCM delivery failure without blocking order creation
    console.error('FCM notification delivery failed:', error);
  }
}

/**
 * Builds the notification payload for an order.
 * Exported for testability (Property 13).
 */
export function buildOrderNotificationPayload(
  tableName: string,
  orderTotal: string
): { title: string; body: string; data: { tableName: string; orderTotal: string } } {
  return {
    title: 'New Order Received',
    body: `Table: ${tableName} — Total: ₹${orderTotal}`,
    data: {
      tableName,
      orderTotal,
    },
  };
}
