import { Pool } from 'pg';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();

const SALT_ROUNDS = 12;

function getAdminCredentials(): { email: string; password: string } {
  const email = process.env.ADMIN_SEED_EMAIL;
  const password = process.env.ADMIN_SEED_PASSWORD;

  if (!email || !password) {
    console.error(
      'ERROR: ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD environment variables must be set.\n' +
      'Example: ADMIN_SEED_EMAIL=admin@example.com ADMIN_SEED_PASSWORD=YourStr0ng!Pass npm run seed'
    );
    process.exit(1);
  }

  if (password.length < 12) {
    console.error('ERROR: ADMIN_SEED_PASSWORD must be at least 12 characters long.');
    process.exit(1);
  }

  return { email, password };
}

async function seedAdmin(): Promise<void> {
  const { email, password } = getAdminCredentials();

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Insert admin only if not already existing (idempotent)
    const result = await pool.query(
      `INSERT INTO admins (id, email, password_hash)
       VALUES (uuid_generate_v4(), $1, $2)
       ON CONFLICT (email) DO NOTHING
       RETURNING id, email`,
      [email, passwordHash]
    );

    if (result.rows.length > 0) {
      console.log(`Admin account created: ${email}`);
    } else {
      console.log(`Admin account already exists: ${email}`);
    }
  } catch (error) {
    console.error('Error seeding admin:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seedAdmin();
