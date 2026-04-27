import cors from 'cors'
import express from 'express'
import { fileURLToPath } from 'node:url'

import { all, get, initializeDatabase, run } from './db.js'
import {
  extractIngredients,
  extractInstructions,
  formatMealSummary,
  getAllMeals,
  getMealAreas,
  getMealById,
  getMealCategories,
} from './mealdb.js'

const PORT = process.env.PORT || 3001
const currentFile = fileURLToPath(import.meta.url)

function parseUserId(request) {
  return Number(request.header('x-user-id') || request.query.userId || 1)
}

async function getSavedMaps(userId) {
  const rows = await all(
    'SELECT recipe_id, is_favorite FROM saves WHERE user_id = ?',
    [userId],
  )

  return {
    savedRecipeIds: new Set(rows.map((row) => row.recipe_id)),
    favoriteMap: new Map(rows.map((row) => [row.recipe_id, row.is_favorite])),
  }
}

async function getRatingMap() {
  const rows = await all(
    `
      SELECT recipe_id, AVG(rating) AS average_rating
      FROM recipe_reviews
      GROUP BY recipe_id
    `,
  )

  return new Map(
    rows.map((row) => [
      row.recipe_id,
      row.average_rating ? Number(row.average_rating).toFixed(1) : null,
    ]),
  )
}

async function getRecipeIngredients(recipeId) {
  return all(
    `
      SELECT i.id, i.name, u.quantity, u.unit, i.description
      FROM uses u
      JOIN ingredients i ON i.id = u.ingredient_id
      WHERE u.recipe_id = ?
      ORDER BY i.name
    `,
    [recipeId],
  )
}

async function getRecipeInstructions(recipeId) {
  return all(
    `
      SELECT step_number AS stepNumber, instruction_text AS instruction
      FROM recipe_instructions
      WHERE recipe_id = ?
      ORDER BY step_number
    `,
    [recipeId],
  )
}

function buildRecipeWhere(search, category, cuisine, savedOnly = false) {
  const clauses = []
  const params = []

  if (savedOnly) {
    clauses.push('s.user_id = ?')
  }
  if (search) {
    clauses.push('LOWER(r.name) LIKE ?')
    params.push(`%${search.toLowerCase()}%`)
  }
  if (category && category !== 'All') {
    clauses.push('r.category = ?')
    params.push(category)
  }
  if (cuisine && cuisine !== 'All') {
    clauses.push('r.cuisine = ?')
    params.push(cuisine)
  }

  return {
    where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    params,
  }
}

async function ensureIngredient(name, description = '') {
  const existing = await get(
    'SELECT id FROM ingredients WHERE LOWER(name) = LOWER(?)',
    [name],
  )

  if (existing) {
    return existing.id
  }

  const inserted = await run(
    'INSERT INTO ingredients (name, description) VALUES (?, ?)',
    [name, description],
  )
  return inserted.lastID
}

async function ensureRecipeImported(recipeId) {
  const existing = await get('SELECT id FROM recipes WHERE id = ?', [recipeId])
  if (existing) {
    return existing.id
  }

  const meal = await getMealById(recipeId)
  if (!meal) {
    throw new Error('Recipe not found in TheMealDB.')
  }

  const instructions = extractInstructions(meal)
  const ingredients = extractIngredients(meal)

  await run(
    `
      INSERT INTO recipes (
        id, external_id, creator_id, name, category, cuisine, image_url, description, instructions_text
      ) VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?)
    `,
    [
      Number(meal.idMeal),
      meal.idMeal,
      meal.strMeal,
      meal.strCategory || 'Unknown',
      meal.strArea || 'Unknown',
      meal.strMealThumb || '',
      instructions[0]?.instruction || 'Imported from TheMealDB.',
      meal.strInstructions || '',
    ],
  )

  for (const instruction of instructions) {
    await run(
      `
        INSERT INTO recipe_instructions (recipe_id, step_number, instruction_text)
        VALUES (?, ?, ?)
      `,
      [Number(meal.idMeal), instruction.stepNumber, instruction.instruction],
    )
  }

  for (const ingredient of ingredients) {
    const ingredientId = await ensureIngredient(
      ingredient.name,
      ingredient.rawMeasure || ingredient.description || '',
    )

    await run(
      `
        INSERT INTO uses (recipe_id, ingredient_id, quantity, unit)
        VALUES (?, ?, ?, ?)
      `,
      [Number(meal.idMeal), ingredientId, ingredient.quantity, ingredient.unit],
    )
  }

  return Number(meal.idMeal)
}

async function buildRecipeDetailFromMeal(meal, userId) {
  const recipeId = Number(meal.idMeal)
  const savedRow = await get(
    'SELECT is_favorite FROM saves WHERE user_id = ? AND recipe_id = ?',
    [userId, recipeId],
  )
  const noteRow = await get(
    'SELECT note FROM recipe_notes WHERE user_id = ? AND recipe_id = ?',
    [userId, recipeId],
  )
  const ratingRow = await get(
    'SELECT AVG(rating) AS average_rating FROM recipe_reviews WHERE recipe_id = ?',
    [recipeId],
  )

  return {
    id: recipeId,
    name: meal.strMeal,
    category: meal.strCategory || 'Unknown',
    cuisine: meal.strArea || 'Unknown',
    imageUrl: meal.strMealThumb || '',
    description:
      extractInstructions(meal)[0]?.instruction ||
      'Open the instructions tab to see the full recipe.',
    saved: Boolean(savedRow),
    favorite: Boolean(savedRow?.is_favorite),
    averageRating: ratingRow?.average_rating
      ? Number(ratingRow.average_rating).toFixed(1)
      : null,
    note: noteRow?.note || '',
    instructions: extractInstructions(meal),
    ingredients: extractIngredients(meal),
  }
}

async function getStoredRecipeDetail(recipeId, userId) {
  const recipe = await get(
    `
      SELECT
        r.id,
        r.name,
        r.category,
        r.cuisine,
        r.image_url AS imageUrl,
        r.description,
        CASE WHEN s.user_id IS NULL THEN 0 ELSE 1 END AS saved,
        COALESCE(s.is_favorite, 0) AS favorite,
        MAX(rn.note) AS note,
        AVG(rr.rating) AS averageRating
      FROM recipes r
      LEFT JOIN saves s ON s.recipe_id = r.id AND s.user_id = ?
      LEFT JOIN recipe_notes rn ON rn.recipe_id = r.id AND rn.user_id = ?
      LEFT JOIN recipe_reviews rr ON rr.recipe_id = r.id
      WHERE r.id = ?
      GROUP BY r.id, r.name, r.category, r.cuisine, r.image_url, r.description, s.user_id, s.is_favorite
    `,
    [userId, userId, recipeId],
  )

  if (!recipe) {
    return null
  }

  return {
    ...recipe,
    saved: Boolean(recipe.saved),
    favorite: Boolean(recipe.favorite),
    averageRating: recipe.averageRating
      ? Number(recipe.averageRating).toFixed(1)
      : null,
    note: recipe.note || '',
    instructions: await getRecipeInstructions(recipeId),
    ingredients: await getRecipeIngredients(recipeId),
  }
}

async function buildIngredientPreview(recipeSelections) {
  const consolidated = new Map()

  for (const selection of recipeSelections) {
    const ingredients = await all(
      `
        SELECT i.id, i.name, u.quantity, u.unit
        FROM uses u
        JOIN ingredients i ON i.id = u.ingredient_id
        WHERE u.recipe_id = ?
      `,
      [selection.recipeId],
    )

    for (const ingredient of ingredients) {
      const multiplier = Number(selection.multiplier || 1)
      const key = String(ingredient.id)
      const existing = consolidated.get(key) || {
        ingredientId: ingredient.id,
        ingredient: ingredient.name,
        quantity: 0,
        unit: ingredient.unit,
      }

      existing.quantity += Number(ingredient.quantity) * multiplier
      consolidated.set(key, existing)
    }
  }

  return [...consolidated.values()]
    .map((item) => ({
      ...item,
      quantity: Number(item.quantity.toFixed(2)),
    }))
    .sort((left, right) => left.ingredient.localeCompare(right.ingredient))
}

function toCsv(items) {
  const rows = ['Ingredient,Quantity,Unit,Purchased,Note']
  for (const item of items) {
    const safe = [
      item.ingredient,
      item.quantity,
      item.unit,
      item.purchased ? 'Yes' : 'No',
      item.note || '',
    ]
      .map((value) => `"${String(value).replaceAll('"', '""')}"`)
      .join(',')
    rows.push(safe)
  }
  return rows.join('\n')
}

export function createApp() {
  const app = express()

  app.use(cors())
  app.use(express.json())

  app.get('/api/health/db', async (_request, response) => {
    try {
      const tables = await all('SHOW TABLES')
      const recipeCount = await get('SELECT COUNT(*) AS recipeCount FROM recipes')

      response.json({
        ok: true,
        recipeCount: recipeCount.recipeCount,
        tables: tables.map((row) => Object.values(row)[0]),
      })
    } catch (error) {
      response.status(500).json({
        ok: false,
        message: error.message,
      })
    }
  })

  app.get('/api/meta', async (_request, response) => {
    try {
      const [categories, cuisines] = await Promise.all([
        getMealCategories(),
        getMealAreas(),
      ])

      response.json({
        categories: ['All', ...categories],
        cuisines: ['All', ...cuisines],
      })
    } catch (_error) {
      const categories = await all('SELECT DISTINCT category FROM recipes ORDER BY category')
      const cuisines = await all('SELECT DISTINCT cuisine FROM recipes ORDER BY cuisine')
      response.json({
        categories: ['All', ...categories.map((row) => row.category)],
        cuisines: ['All', ...cuisines.map((row) => row.cuisine)],
      })
    }
  })

  app.get('/api/landing-recipes', async (_request, response) => {
    try {
      const meals = await getAllMeals()
      const preview = meals
        .slice(0, 12)
        .map((meal) => formatMealSummary(meal))
      response.json({
        count: meals.length,
        recipes: preview,
      })
    } catch (_error) {
      response.status(502).json({ message: 'Unable to load preview recipes right now.' })
    }
  })

  app.post('/api/auth/signup', async (request, response) => {
    const { name, email, password } = request.body

    if (!name || !email || !password) {
      response.status(400).json({ message: 'Name, email, and password are required.' })
      return
    }

    try {
      const result = await run(
        'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
        [name, email, password],
      )
      await run(
        `
          INSERT INTO user_settings (
            user_id, default_list_name, preferred_export_format, show_purchased_in_exports, show_notes_in_exports, accent_mode
          ) VALUES (?, 'Weekly Groceries', 'csv', 1, 1, 'warm')
        `,
        [result.lastID],
      )
      const user = await get('SELECT id, name, email FROM users WHERE id = ?', [result.lastID])
      response.status(201).json(user)
    } catch (_error) {
      response.status(400).json({ message: 'That email is already in use.' })
    }
  })

  app.get('/api/me', async (request, response) => {
    const userId = parseUserId(request)
    const user = await get(
      'SELECT id, name, email FROM users WHERE id = ?',
      [userId],
    )

    if (!user) {
      response.status(404).json({ message: 'User not found.' })
      return
    }

    response.json(user)
  })

  app.patch('/api/me', async (request, response) => {
    const userId = parseUserId(request)
    const { name, email, password } = request.body

    const current = await get('SELECT id, name, email, password FROM users WHERE id = ?', [userId])
    if (!current) {
      response.status(404).json({ message: 'User not found.' })
      return
    }

    try {
      await run(
        `
          UPDATE users
          SET name = ?, email = ?, password = ?
          WHERE id = ?
        `,
        [
          name || current.name,
          email || current.email,
          password || current.password,
          userId,
        ],
      )

      const updated = await get('SELECT id, name, email FROM users WHERE id = ?', [userId])
      response.json(updated)
    } catch (_error) {
      response.status(400).json({ message: 'Could not update that profile.' })
    }
  })

  app.get('/api/me/settings', async (request, response) => {
    const userId = parseUserId(request)
    let settings = await get(
      `
        SELECT
          user_id AS userId,
          default_list_name AS defaultListName,
          preferred_export_format AS preferredExportFormat,
          show_purchased_in_exports AS showPurchasedInExports,
          show_notes_in_exports AS showNotesInExports,
          accent_mode AS temperature
        FROM user_settings
        WHERE user_id = ?
      `,
      [userId],
    )

    if (!settings) {
      await run(
        `
          INSERT INTO user_settings (
            user_id, default_list_name, preferred_export_format, show_purchased_in_exports, show_notes_in_exports, accent_mode
          ) VALUES (?, 'Weekly Groceries', 'csv', 1, 1, 'warm')
        `,
        [userId],
      )
      settings = await get(
        `
          SELECT
            user_id AS userId,
            default_list_name AS defaultListName,
            preferred_export_format AS preferredExportFormat,
            show_purchased_in_exports AS showPurchasedInExports,
            show_notes_in_exports AS showNotesInExports,
            accent_mode AS temperature
          FROM user_settings
          WHERE user_id = ?
        `,
        [userId],
      )
    }

    response.json({
      ...settings,
      showPurchasedInExports: Boolean(settings.showPurchasedInExports),
      showNotesInExports: Boolean(settings.showNotesInExports),
    })
  })

  app.patch('/api/me/settings', async (request, response) => {
    const userId = parseUserId(request)
    const {
      defaultListName,
      preferredExportFormat,
      showPurchasedInExports,
      showNotesInExports,
      temperature,
    } = request.body

    await run(
      `
        INSERT INTO user_settings (
          user_id, default_list_name, preferred_export_format, show_purchased_in_exports, show_notes_in_exports, accent_mode
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          default_list_name = VALUES(default_list_name),
          preferred_export_format = VALUES(preferred_export_format),
          show_purchased_in_exports = VALUES(show_purchased_in_exports),
          show_notes_in_exports = VALUES(show_notes_in_exports),
          accent_mode = VALUES(accent_mode)
      `,
      [
        userId,
        defaultListName || 'Weekly Groceries',
        preferredExportFormat || 'csv',
        showPurchasedInExports ? 1 : 0,
        showNotesInExports ? 1 : 0,
        temperature || 'warm',
      ],
    )

    const updated = await get(
      `
        SELECT
          user_id AS userId,
          default_list_name AS defaultListName,
          preferred_export_format AS preferredExportFormat,
          show_purchased_in_exports AS showPurchasedInExports,
          show_notes_in_exports AS showNotesInExports,
          accent_mode AS temperature
        FROM user_settings
        WHERE user_id = ?
      `,
      [userId],
    )

    response.json({
      ...updated,
      showPurchasedInExports: Boolean(updated.showPurchasedInExports),
      showNotesInExports: Boolean(updated.showNotesInExports),
    })
  })

  app.post('/api/auth/login', async (request, response) => {
    const { email, password } = request.body
    const user = await get(
      'SELECT id, name, email FROM users WHERE email = ? AND password = ?',
      [email, password],
    )

    if (!user) {
      response.status(401).json({ message: 'Invalid email or password.' })
      return
    }

    response.json(user)
  })

  app.get('/api/discover', async (request, response) => {
    const userId = parseUserId(request)
    const { search = '', category = 'All', cuisine = 'All' } = request.query

    try {
      const [{ savedRecipeIds, favoriteMap }, ratingMap, meals] = await Promise.all([
        getSavedMaps(userId),
        getRatingMap(),
        getAllMeals(),
      ])

      const searchText = search.toLowerCase()
      const filteredMeals = meals.filter((meal) => {
        if (searchText && !meal.strMeal.toLowerCase().includes(searchText)) {
          return false
        }
        if (category !== 'All' && meal.strCategory !== category) {
          return false
        }
        if (cuisine !== 'All' && meal.strArea !== cuisine) {
          return false
        }
        return true
      })

      response.json(
        filteredMeals.map((meal) =>
          formatMealSummary(meal, savedRecipeIds, favoriteMap, ratingMap),
        ),
      )
    } catch (_error) {
      response.status(502).json({ message: 'Unable to load recipes from TheMealDB right now.' })
    }
  })

  app.get('/api/recipes/:id', async (request, response) => {
    const userId = parseUserId(request)
    const recipeId = Number(request.params.id)

    try {
      const meal = await getMealById(recipeId)
      if (meal) {
        response.json(await buildRecipeDetailFromMeal(meal, userId))
        return
      }
    } catch (_error) {
      // Fall back to locally saved data below.
    }

    const storedRecipe = await getStoredRecipeDetail(recipeId, userId)
    if (!storedRecipe) {
      response.status(404).json({ message: 'Recipe not found.' })
      return
    }

    response.json(storedRecipe)
  })

  app.post('/api/recipes/:id/save', async (request, response) => {
    const userId = parseUserId(request)
    const recipeId = Number(request.params.id)

    try {
      await ensureRecipeImported(recipeId)
      await run(
        `
          INSERT IGNORE INTO saves (user_id, recipe_id, is_favorite)
          VALUES (?, ?, 0)
        `,
        [userId, recipeId],
      )

      response.status(201).json({ message: 'Recipe saved.' })
    } catch (error) {
      console.error('Recipe import failed:', error)
      response.status(502).json({ message: 'Could not import that recipe from TheMealDB.' })
    }
  })

  app.delete('/api/recipes/:id/save', async (request, response) => {
    const userId = parseUserId(request)
    await run(
      'DELETE FROM saves WHERE user_id = ? AND recipe_id = ?',
      [userId, request.params.id],
    )
    await run(
      'DELETE FROM recipe_notes WHERE user_id = ? AND recipe_id = ?',
      [userId, request.params.id],
    )
    response.json({ message: 'Recipe removed.' })
  })

  app.patch('/api/recipes/:id/favorite', async (request, response) => {
    const userId = parseUserId(request)
    const { favorite } = request.body

    await run(
      'UPDATE saves SET is_favorite = ? WHERE user_id = ? AND recipe_id = ?',
      [favorite ? 1 : 0, userId, request.params.id],
    )
    response.json({ message: 'Favorite updated.' })
  })

  app.put('/api/recipes/:id/note', async (request, response) => {
    const userId = parseUserId(request)
    const { note = '' } = request.body

    await run(
      `
        INSERT INTO recipe_notes (user_id, recipe_id, note)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE
          note = VALUES(note)
      `,
      [userId, request.params.id, note],
    )
    response.json({ message: 'Note saved.' })
  })

  app.get('/api/my-recipes', async (request, response) => {
    const userId = parseUserId(request)
    const { search = '', category = 'All', cuisine = 'All', favorites = 'false' } = request.query
    const filters = buildRecipeWhere(search, category, cuisine, true)
    const clauses = [...(filters.where ? [filters.where.replace(/^WHERE /, '')] : [])]
    const params = [userId, ...filters.params]

    if (favorites === 'true') {
      clauses.push('s.is_favorite = 1')
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''

    const rows = await all(
      `
        SELECT
          r.id,
          r.name,
          r.category,
          r.cuisine,
          r.image_url,
          r.description,
          1 AS saved,
          s.is_favorite,
          AVG(rr.rating) AS average_rating
        FROM saves s
        JOIN recipes r ON r.id = s.recipe_id
        LEFT JOIN recipe_reviews rr ON rr.recipe_id = r.id
        ${where}
        GROUP BY r.id, r.name, r.category, r.cuisine, r.image_url, r.description, s.is_favorite
        ORDER BY s.saved_at DESC
      `,
      params,
    )

    response.json(
      rows.map((row) => ({
        id: row.id,
        name: row.name,
        category: row.category,
        cuisine: row.cuisine,
        imageUrl: row.image_url,
        description: row.description,
        saved: true,
        favorite: Boolean(row.is_favorite),
        averageRating: row.average_rating
          ? Number(row.average_rating).toFixed(1)
          : null,
      })),
    )
  })

  app.post('/api/grocery-lists/preview', async (request, response) => {
    const { selections = [] } = request.body
    const items = await buildIngredientPreview(selections)
    response.json({
      selectedRecipes: selections.length,
      uniqueIngredients: items.length,
      items,
    })
  })

  app.post('/api/grocery-lists', async (request, response) => {
    const userId = parseUserId(request)
    const { name, description = '', selections = [] } = request.body

    if (!name || !selections.length) {
      response.status(400).json({ message: 'A list name and at least one recipe are required.' })
      return
    }

    const created = await run(
      'INSERT INTO grocery_lists (creator_id, name, description) VALUES (?, ?, ?)',
      [userId, name, description],
    )

    const items = await buildIngredientPreview(selections)
    for (const item of items) {
      await run(
        `
          INSERT INTO contains (grocery_list_id, ingredient_id, quantity, unit, purchased, note)
          VALUES (?, ?, ?, ?, 0, '')
          ON DUPLICATE KEY UPDATE
            quantity = VALUES(quantity),
            unit = VALUES(unit),
            purchased = VALUES(purchased),
            note = VALUES(note)
        `,
        [created.lastID, item.ingredientId, item.quantity, item.unit],
      )
    }

    const list = await get(
      'SELECT id, name FROM grocery_lists WHERE id = ?',
      [created.lastID],
    )
    response.status(201).json(list)
  })

  app.get('/api/grocery-lists', async (request, response) => {
    const userId = parseUserId(request)
    const { search = '' } = request.query
    try {
      const rows = await all(
        `
          SELECT
            gl.id,
            gl.name,
            gl.description,
            gl.created_at AS createdAt,
            gl.updated_at AS updatedAt,
            COUNT(c.ingredient_id) AS itemCount
          FROM grocery_lists gl
          LEFT JOIN contains c ON c.grocery_list_id = gl.id
          WHERE gl.creator_id = ? AND LOWER(gl.name) LIKE ?
          GROUP BY gl.id, gl.name, gl.description, gl.created_at, gl.updated_at
          ORDER BY gl.updated_at DESC
        `,
        [userId, `%${search.toLowerCase()}%`],
      )

      response.json(rows)
    } catch (error) {
      console.error('Load grocery lists failed:', error)
      response.status(500).json({ message: error.message })
    }
  })

  app.get('/api/grocery-lists/:id', async (request, response) => {
    const userId = parseUserId(request)
    const uncheckedOnly = request.query.uncheckedOnly === 'true'
    const search = (request.query.search || '').toLowerCase()

    try {
      const list = await get(
        `
          SELECT id, name, description, created_at AS createdAt, updated_at AS updatedAt
          FROM grocery_lists
          WHERE id = ? AND creator_id = ?
        `,
        [request.params.id, userId],
      )

      if (!list) {
        response.status(404).json({ message: 'Grocery list not found.' })
        return
      }

      const items = await all(
        `
          SELECT
            i.id AS ingredientId,
            i.name AS ingredient,
            c.quantity,
            c.unit,
            c.purchased,
            c.note
          FROM contains c
          JOIN ingredients i ON i.id = c.ingredient_id
          WHERE c.grocery_list_id = ?
            AND LOWER(i.name) LIKE ?
            ${uncheckedOnly ? 'AND c.purchased = 0' : ''}
          ORDER BY i.name
        `,
        [request.params.id, `%${search}%`],
      )

      response.json({
        ...list,
        items,
      })
    } catch (error) {
      console.error('Load grocery list detail failed:', error)
      response.status(500).json({ message: error.message })
    }
  })

  app.put('/api/grocery-lists/:id', async (request, response) => {
    const userId = parseUserId(request)
    const { name, description = '' } = request.body

    await run(
      `
        UPDATE grocery_lists
        SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND creator_id = ?
      `,
      [name, description, request.params.id, userId],
    )
    response.json({ message: 'List updated.' })
  })

  app.patch('/api/grocery-lists/:id/items/:ingredientId', async (request, response) => {
    const { quantity, unit, purchased, note } = request.body

    await run(
      `
        UPDATE contains
        SET
          quantity = COALESCE(?, quantity),
          unit = COALESCE(?, unit),
          purchased = COALESCE(?, purchased),
          note = COALESCE(?, note)
        WHERE grocery_list_id = ? AND ingredient_id = ?
      `,
      [
        quantity ?? null,
        unit ?? null,
        purchased === undefined ? null : purchased ? 1 : 0,
        note ?? null,
        request.params.id,
        request.params.ingredientId,
      ],
    )

    await run(
      'UPDATE grocery_lists SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [request.params.id],
    )

    response.json({ message: 'Item updated.' })
  })

  app.delete('/api/grocery-lists/:id/items/:ingredientId', async (request, response) => {
    await run(
      'DELETE FROM contains WHERE grocery_list_id = ? AND ingredient_id = ?',
      [request.params.id, request.params.ingredientId],
    )
    await run(
      'UPDATE grocery_lists SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [request.params.id],
    )
    response.json({ message: 'Item removed.' })
  })

  app.delete('/api/grocery-lists/:id', async (request, response) => {
    const userId = parseUserId(request)

    try {
      const list = await get(
        'SELECT id FROM grocery_lists WHERE id = ? AND creator_id = ?',
        [request.params.id, userId],
      )

      if (!list) {
        response.status(404).json({ message: 'Grocery list not found.' })
        return
      }

      await run(
        'DELETE FROM contains WHERE grocery_list_id = ?',
        [request.params.id],
      )

      await run(
        'DELETE FROM grocery_lists WHERE id = ? AND creator_id = ?',
        [request.params.id, userId],
      )

      response.json({ message: 'List deleted.' })
    } catch (error) {
      console.error('Delete grocery list failed:', error)
      response.status(500).json({ message: error.message })
    }
  })

  app.get('/api/grocery-lists/:id/export', async (request, response) => {
    const userId = parseUserId(request)
    const format = request.query.format === 'json' ? 'json' : 'csv'
    const includePurchased = request.query.includePurchased !== 'false'
    const includeNotes = request.query.includeNotes !== 'false'

    const list = await get(
      'SELECT id, name FROM grocery_lists WHERE id = ? AND creator_id = ?',
      [request.params.id, userId],
    )

    if (!list) {
      response.status(404).json({ message: 'List not found.' })
      return
    }

    const rows = await all(
      `
        SELECT i.name AS ingredient, c.quantity, c.unit, c.purchased, c.note
        FROM contains c
        JOIN ingredients i ON i.id = c.ingredient_id
        WHERE c.grocery_list_id = ?
        ORDER BY i.name
      `,
      [request.params.id],
    )

    const items = rows.map((row) => ({
      ingredient: row.ingredient,
      quantity: row.quantity,
      unit: row.unit,
      ...(includePurchased ? { purchased: Boolean(row.purchased) } : {}),
      ...(includeNotes ? { note: row.note } : {}),
    }))

    if (format === 'json') {
      response.setHeader('Content-Type', 'application/json')
      response.setHeader(
        'Content-Disposition',
        `attachment; filename="${list.name.replaceAll(' ', '-').toLowerCase()}.json"`,
      )
      response.send(JSON.stringify({ list: list.name, items }, null, 2))
      return
    }

    response.setHeader('Content-Type', 'text/csv')
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${list.name.replaceAll(' ', '-').toLowerCase()}.csv"`,
    )
    response.send(
      toCsv(
        items.map((item) => ({
          ...item,
          purchased: item.purchased ?? false,
          note: item.note ?? '',
        })),
      ),
    )
  })

  app.get('/api/health', (_request, response) => {
    response.json({ ok: true })
  })

  return app
}

export async function startServer(port = PORT) {
  await initializeDatabase()
  const app = createApp()

  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      console.log(`PantryPal API running on http://localhost:${port}`)
      resolve(server)
    })
  })
}

if (process.argv[1] === currentFile) {
  startServer().catch((error) => {
    console.error('Failed to initialize database', error)
    process.exit(1)
  })
}