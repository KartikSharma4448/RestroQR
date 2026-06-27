import { Pool } from 'pg';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();

const SALT_ROUNDS = 10;

const DEFAULT_ADMIN = {
  email: 'admin@restroqr.com',
  password: 'Admin@123',
};

async function seedAdmin(): Promise<void> {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const passwordHash = await bcrypt.hash(DEFAULT_ADMIN.password, SALT_ROUNDS);

    // Insert admin only if not already existing (idempotent)
    const result = await pool.query(
      `INSERT INTO admins (id, email, password_hash)
       VALUES (uuid_generate_v4(), $1, $2)
       ON CONFLICT (email) DO NOTHING
       RETURNING id, email`,
      [DEFAULT_ADMIN.email, passwordHash]
    );

    if (result.rows.length > 0) {
      console.log(`Default admin account created: ${DEFAULT_ADMIN.email}`);
    } else {
      console.log(`Admin account already exists: ${DEFAULT_ADMIN.email}`);
    }
  } catch (error) {
    console.error('Error seeding admin:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seedAdmin();
