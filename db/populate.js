// populate.js
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
require('dotenv').config();

// 1) Get connection string: CLI arg wins, fallback to env
const connectionString = process.argv[2] || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('Error: No PostgreSQL connection string provided.');
  process.exit(1);
}

// 2) Create a pool for THIS script (don’t reuse app pool)
const pool = new Pool({ connectionString });

async function populate() {
  try {
    console.log('Starting database setup...');
    await pool.query('BEGIN');

    // 3) Create enum type for roles (idempotent)
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'roles') THEN
          CREATE TYPE roles AS ENUM ('admin', 'user', 'spectator');
        END IF;
      END
      $$;
    `);

    // 4) Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) NOT NULL,
        firstName VARCHAR(100) NOT NULL,
        lastName VARCHAR(100) NOT NULL,
        password TEXT NOT NULL,
        roleName roles NOT NULL
      );
    `);


    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        message_id SERIAL PRIMARY KEY,
        creationDate TIMESTAMP NOT NULL DEFAULT NOW(),
        content TEXT NOT NULL
      );
    `);


    await pool.query(`
      CREATE TABLE IF NOT EXISTS users_messages (
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        message_id INT REFERENCES messages(message_id) ON DELETE CASCADE
      );
    `);

    console.log('Tables ensured.');

    // 7) Hash admin password from env
    // 7) Hash admin password from env
    const plainAdminPass = process.env.ADMINPASS;
    if (!plainAdminPass) {
      throw new Error('ADMINPASS is not set in environment variables.');
    }

    const adminPassword = await bcrypt.hash(plainAdminPass, 10);

    // 8) Insert admin only if not existing
    const existingAdmin = await pool.query(
      `SELECT * FROM users WHERE roleName = 'admin' LIMIT 1;`
    );

    if (existingAdmin.rows.length === 0) {
      await pool.query(
        `INSERT INTO users (username,firstName, lastName, password, roleName)
         VALUES ($1, $2, $3, $4,$5)`,
        ['Admin','Admin', 'User', adminPassword, 'admin']
      );
      console.log('Admin user created.');
    } else {
      console.log('Admin already exists, skipping insert.');
    }

    await pool.query('COMMIT');
    console.log('Database populated (admin only, no messages).');
  } catch (err) {
    try {
      await pool.query('ROLLBACK');
    } catch (_) {}
    console.error('Population failed:', err);
  } finally {
    await pool.end();
  }
}

populate();
