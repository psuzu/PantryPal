import path from 'node:path'
import sqlite3 from 'sqlite3'
import { fileURLToPath } from 'node:url'

import {
  seedUsers,
} from './seed.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const dbPath = path.join(__dirname, '../data/pantrypal.db')

sqlite3.verbose()

export const db = new sqlite3.Database(dbPath)

export function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(error) {
      if (error) {
        reject(error)
        return
      }
      resolve({ lastID: this.lastID, changes: this.changes })
    })
  })
}

export function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) {
        reject(error)
        return
      }
      resolve(row)
    })
  })
}

export function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) {
        reject(error)
        return
      }
      resolve(rows)
    })
  })
}

async function createSchema() {
  await run('PRAGMA foreign_keys = ON')

  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL
    )
  `)

  await run(`
    CREATE TABLE IF NOT EXISTS recipes (
      id INTEGER PRIMARY KEY,
      external_id TEXT UNIQUE,
      creator_id INTEGER DEFAULT 1,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      cuisine TEXT NOT NULL,
      image_url TEXT NOT NULL,
      description TEXT NOT NULL,
      instructions_text TEXT NOT NULL,
      FOREIGN KEY (creator_id) REFERENCES users(id)
    )
  `)

  await run(`
    CREATE TABLE IF NOT EXISTS ingredients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT DEFAULT ''
    )
  `)

  await run(`
    CREATE TABLE IF NOT EXISTS recipe_instructions (
      recipe_id INTEGER NOT NULL,
      step_number INTEGER NOT NULL,
      instruction_text TEXT NOT NULL,
      PRIMARY KEY (recipe_id, step_number),
      FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
    )
  `)

  await run(`
    CREATE TABLE IF NOT EXISTS uses (
      recipe_id INTEGER NOT NULL,
      ingredient_id INTEGER NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      PRIMARY KEY (recipe_id, ingredient_id),
      FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
      FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE
    )
  `)

  await run(`
    CREATE TABLE IF NOT EXISTS grocery_lists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      creator_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `)

  await run(`
    CREATE TABLE IF NOT EXISTS contains (
      grocery_list_id INTEGER NOT NULL,
      ingredient_id INTEGER NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      purchased INTEGER NOT NULL DEFAULT 0,
      note TEXT DEFAULT '',
      PRIMARY KEY (grocery_list_id, ingredient_id),
      FOREIGN KEY (grocery_list_id) REFERENCES grocery_lists(id) ON DELETE CASCADE,
      FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE
    )
  `)

  await run(`
    CREATE TABLE IF NOT EXISTS saves (
      user_id INTEGER NOT NULL,
      recipe_id INTEGER NOT NULL,
      is_favorite INTEGER NOT NULL DEFAULT 0,
      saved_at TEXT DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, recipe_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
    )
  `)

  await run(`
    CREATE TABLE IF NOT EXISTS recipe_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      recipe_id INTEGER NOT NULL,
      rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
      review TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (user_id, recipe_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
    )
  `)

  await run(`
    CREATE TABLE IF NOT EXISTS recipe_notes (
      user_id INTEGER NOT NULL,
      recipe_id INTEGER NOT NULL,
      note TEXT DEFAULT '',
      PRIMARY KEY (user_id, recipe_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
    )
  `)

  await run(`
    CREATE TABLE IF NOT EXISTS user_settings (
      user_id INTEGER PRIMARY KEY,
      default_list_name TEXT DEFAULT 'Weekly Groceries',
      preferred_export_format TEXT DEFAULT 'csv',
      show_purchased_in_exports INTEGER NOT NULL DEFAULT 1,
      show_notes_in_exports INTEGER NOT NULL DEFAULT 1,
      accent_mode TEXT DEFAULT 'warm',
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `)
}

async function seedIfEmpty() {
  const userCount = await get('SELECT COUNT(*) AS count FROM users')
  if (userCount.count > 0) {
    return
  }

  for (const user of seedUsers) {
    const result = await run(
      'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
      [user.name, user.email, user.password],
    )
    await run(
      `
        INSERT INTO user_settings (
          user_id, default_list_name, preferred_export_format, show_purchased_in_exports, show_notes_in_exports, accent_mode
        ) VALUES (?, 'Weekly Groceries', 'csv', 1, 1, 'warm')
      `,
      [result.lastID],
    )
  }
}

export async function initializeDatabase() {
  await createSchema()
  await seedIfEmpty()
}
