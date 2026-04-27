const MEAL_DB_BASE = 'https://www.themealdb.com/api/json/v1/1'
const alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('')

const cache = {
  allMeals: {
    expiresAt: 0,
    data: null,
  },
  categories: {
    expiresAt: 0,
    data: null,
  },
  areas: {
    expiresAt: 0,
    data: null,
  },
}

async function fetchMealDb(path) {
  const response = await fetch(`${MEAL_DB_BASE}${path}`)
  if (!response.ok) {
    throw new Error(`TheMealDB request failed: ${response.status}`)
  }
  return response.json()
}

function withCache(entry, value) {
  entry.data = value
  entry.expiresAt = Date.now() + 30 * 60 * 1000
  return value
}

function parseFraction(token) {
  if (!token) {
    return null
  }

  if (token.includes('/')) {
    const [numerator, denominator] = token.split('/').map(Number)
    if (!Number.isNaN(numerator) && !Number.isNaN(denominator) && denominator !== 0) {
      return numerator / denominator
    }
    return null
  }

  const value = Number(token)
  return Number.isNaN(value) ? null : value
}

function normalizeMeasureText(measure) {
  return measure
    .replaceAll('½', '1/2')
    .replaceAll('¼', '1/4')
    .replaceAll('¾', '3/4')
    .replaceAll('⅓', '1/3')
    .replaceAll('⅔', '2/3')
    .replaceAll('⅛', '1/8')
    .replaceAll(/\s+/g, ' ')
    .trim()
}

export function parseMeasure(measure) {
  const normalized = normalizeMeasureText(measure || '')
  if (!normalized) {
    return { quantity: 1, unit: 'item' }
  }

  const tokens = normalized.split(' ')
  let quantity = parseFraction(tokens[0])
  let consumed = 1

  if (quantity !== null && tokens[1]?.includes('/')) {
    const fraction = parseFraction(tokens[1])
    if (fraction !== null) {
      quantity += fraction
      consumed = 2
    }
  }

  if (quantity === null) {
    return {
      quantity: 1,
      unit: normalized,
    }
  }

  const unit = tokens.slice(consumed).join(' ').trim() || 'item'
  return {
    quantity: Number(quantity.toFixed(2)),
    unit,
  }
}

export function extractIngredients(meal) {
  const ingredients = []

  for (let index = 1; index <= 20; index += 1) {
    const ingredientName = meal[`strIngredient${index}`]?.trim()
    const measure = meal[`strMeasure${index}`]?.trim()

    if (!ingredientName) {
      continue
    }

    const parsed = parseMeasure(measure)
    ingredients.push({
      name: ingredientName,
      description: measure || '',
      quantity: parsed.quantity,
      unit: parsed.unit,
      rawMeasure: measure || '',
    })
  }

  return ingredients
}

export function extractInstructions(meal) {
  const source = meal.strInstructions || ''
  return source
    .split(/\r?\n/)
    .map((step) => step.trim())
    .filter(Boolean)
    .map((instruction, index) => ({
      stepNumber: index + 1,
      instruction,
    }))
}

export function formatMealSummary(meal, savedRecipeIds = new Set(), favoriteMap = new Map(), ratingMap = new Map()) {
  const id = Number(meal.idMeal || meal.id)
  return {
    id,
    name: meal.strMeal || meal.name,
    category: meal.strCategory || meal.category,
    cuisine: meal.strArea || meal.cuisine,
    imageUrl: meal.strMealThumb || meal.image_url,
    description:
      meal.strInstructions?.split(/\r?\n/).find(Boolean)?.slice(0, 160) ||
      meal.description ||
      'Open the recipe to view ingredients and cooking instructions.',
    saved: savedRecipeIds.has(id),
    favorite: Boolean(favoriteMap.get(id)),
    averageRating: ratingMap.get(id) ?? null,
  }
}

export async function getMealCategories() {
  if (cache.categories.data && cache.categories.expiresAt > Date.now()) {
    return cache.categories.data
  }

  const payload = await fetchMealDb('/list.php?c=list')
  return withCache(
    cache.categories,
    (payload.meals || []).map((entry) => entry.strCategory).sort(),
  )
}

export async function getMealAreas() {
  if (cache.areas.data && cache.areas.expiresAt > Date.now()) {
    return cache.areas.data
  }

  const payload = await fetchMealDb('/list.php?a=list')
  return withCache(
    cache.areas,
    (payload.meals || []).map((entry) => entry.strArea).sort(),
  )
}

export async function getAllMeals() {
  if (cache.allMeals.data && cache.allMeals.expiresAt > Date.now()) {
    return cache.allMeals.data
  }

  const pages = await Promise.all(
    alphabet.map(async (letter) => {
      const payload = await fetchMealDb(`/search.php?f=${letter}`)
      return payload.meals || []
    }),
  )

  const meals = pages.flat()
  return withCache(cache.allMeals, meals)
}

export async function getMealById(id) {
  const payload = await fetchMealDb(`/lookup.php?i=${id}`)
  return payload.meals?.[0] || null
}
