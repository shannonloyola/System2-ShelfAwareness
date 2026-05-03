import pg from 'pg';
import { env } from './src/config/env.js';

const { Pool } = pg;
const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: { rejectUnauthorized: false }
});

async function checkSchema() {
  try {
    const res = await pool.query("SELECT * FROM delivery_schedules LIMIT 3");
    console.log('Sample data from delivery_schedules:', JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error('Error fetching schema:', err);
  } finally {
    await pool.end();
  }
}

checkSchema();
