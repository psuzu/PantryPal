import 'dotenv/config'
import mysql from 'mysql2/promise'

const requiredEnv = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME']

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
}

export const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT || 3306),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
})

export async function all(sql, params = []) {
  const [rows] = await db.execute(sql, params)
  return rows
}

export async function get(sql, params = []) {
  const rows = await all(sql, params)
  return rows[0] || null
}

export async function run(sql, params = []) {
  const [result] = await db.execute(sql, params)

  return {
    lastID: result.insertId,
    insertId: result.insertId,
    changes: result.affectedRows,
    affectedRows: result.affectedRows,
  }
}

export async function initializeDatabase() {
  await get('SELECT 1 AS connected')
}
