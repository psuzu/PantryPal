# PantryPal

PantryPal is a React + Express recipe planner built to match the CS4750 proposal and milestone scope while staying compliant with the final-project requirement that database work be written with raw SQL.

Recipe discovery and recipe detail browsing come from [TheMealDB API](https://www.themealdb.com/api.php). Once a user saves a recipe, PantryPal imports that recipe into SQLite with handwritten SQL so saved recipes, notes, grocery lists, and exports are managed by your own database code.

## Stack

- Frontend: React + Vite
- Backend: Express
- Database: SQLite with handwritten SQL queries
- No ORM is used
- External recipe source: TheMealDB

## Features

- Landing, sign up, and log in flows
- Discover recipes with search and filters
- Save recipes into a personal collection
- View saved recipe details with personal notes
- Build grocery lists from saved recipes with ingredient consolidation
- Manage grocery list items with updates, notes, and purchased toggles
- Export grocery lists as CSV or JSON
- Delete saved recipes and grocery lists with confirmation modals

## Demo account

- Email: `suzu@pantrypal.app`
- Password: `demo1234`

## Run locally

From the project root, install the root helper package once:

```bash
npm install
```

Then install app dependencies:

```bash
npm run install:all
```

Then start both frontend and backend together:

```bash
npm run dev
```

Then open the Vite URL shown in the terminal, usually `http://localhost:5173`.

If you ever want to run them separately, you still can:

```bash
cd server && npm run start
cd client && npm run dev
```

## Database notes

The backend creates and seeds `server/data/pantrypal.db` automatically on startup. The schema includes:

- `users`
- `recipes`
- `ingredients`
- `recipe_instructions`
- `uses`
- `saves`
- `recipe_notes`
- `recipe_reviews`
- `grocery_lists`
- `contains`

All database interactions are handled through direct SQL statements in [server/src/db.js](/Users/suzupaudel/Desktop/UVA/Year%203/Spring/CS4750/PantryPal/PantryPal/server/src/db.js) and [server/src/server.js](/Users/suzupaudel/Desktop/UVA/Year%203/Spring/CS4750/PantryPal/PantryPal/server/src/server.js).
