export const seedUsers = [
  {
    name: 'Suzu Paudel',
    email: 'suzu@pantrypal.app',
    password: 'demo1234',
  },
  {
    name: 'Jamie Carter',
    email: 'jamie@pantrypal.app',
    password: 'demo1234',
  },
]

export const seedRecipes = [
  {
    id: 101,
    externalId: '52795',
    name: 'Chicken Handi',
    category: 'Dinner',
    cuisine: 'Indian',
    imageUrl:
      'https://www.themealdb.com/images/media/meals/wyxwsp1486979827.jpg',
    description:
      'A warming tomato-based curry with cream, chilies, and pantry spices.',
    instructions: [
      'Heat oil in a large pan and saute onion, ginger, and garlic until fragrant.',
      'Add spices and tomatoes, then simmer until thick and glossy.',
      'Fold in chicken pieces and cook until tender.',
      'Finish with cream and cilantro before serving.',
    ],
    ingredients: [
      { name: 'Chicken thighs', quantity: 1.5, unit: 'lb', description: 'Boneless pieces' },
      { name: 'Onion', quantity: 1, unit: 'large', description: 'Thinly sliced' },
      { name: 'Tomatoes', quantity: 3, unit: 'whole', description: 'Diced' },
      { name: 'Heavy cream', quantity: 0.5, unit: 'cup', description: 'For sauce' },
      { name: 'Garlic', quantity: 4, unit: 'cloves', description: 'Minced' },
      { name: 'Ginger', quantity: 1, unit: 'tbsp', description: 'Freshly grated' },
      { name: 'Garam masala', quantity: 2, unit: 'tsp', description: 'Warming spice blend' },
    ],
  },
  {
    id: 102,
    externalId: '52804',
    name: 'Poutine',
    category: 'Comfort Food',
    cuisine: 'Canadian',
    imageUrl:
      'https://www.themealdb.com/images/media/meals/uuyrrx1487327597.jpg',
    description:
      'Crispy fries, rich gravy, and cheese curds for a classic late-night plate.',
    instructions: [
      'Bake or fry potatoes until deeply golden and crisp.',
      'Warm gravy with black pepper until silky.',
      'Pile fries into bowls, top with cheese curds, and spoon over the hot gravy.',
    ],
    ingredients: [
      { name: 'Russet potatoes', quantity: 4, unit: 'whole', description: 'Cut into fries' },
      { name: 'Cheese curds', quantity: 2, unit: 'cups', description: 'Fresh curds' },
      { name: 'Brown gravy', quantity: 2, unit: 'cups', description: 'Hot and seasoned' },
      { name: 'Black pepper', quantity: 1, unit: 'tsp', description: 'Freshly cracked' },
    ],
  },
  {
    id: 103,
    externalId: '52819',
    name: 'Kumpir',
    category: 'Lunch',
    cuisine: 'Turkish',
    imageUrl:
      'https://www.themealdb.com/images/media/meals/mlchx21564916997.jpg',
    description:
      'Loaded baked potatoes mashed with butter and cheese, then topped to taste.',
    instructions: [
      'Bake potatoes until very soft inside.',
      'Split open and mash the interiors with butter and kasar cheese.',
      'Top with corn, olives, sausage, and pickles before serving.',
    ],
    ingredients: [
      { name: 'Baking potatoes', quantity: 2, unit: 'whole', description: 'Large potatoes' },
      { name: 'Butter', quantity: 4, unit: 'tbsp', description: 'Softened' },
      { name: 'Mozzarella', quantity: 1, unit: 'cup', description: 'Shredded cheese blend' },
      { name: 'Sweet corn', quantity: 0.5, unit: 'cup', description: 'Drained kernels' },
      { name: 'Black olives', quantity: 0.25, unit: 'cup', description: 'Sliced' },
      { name: 'Pickles', quantity: 0.25, unit: 'cup', description: 'Chopped' },
    ],
  },
  {
    id: 104,
    externalId: '53016',
    name: 'Bean Chili',
    category: 'Dinner',
    cuisine: 'American',
    imageUrl:
      'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80',
    description:
      'Hearty vegetarian chili with beans, tomatoes, peppers, and a smoky finish.',
    instructions: [
      'Saute onion and bell pepper until softened.',
      'Add tomato paste, beans, broth, and spices.',
      'Simmer until thickened and top with yogurt or cheddar.',
    ],
    ingredients: [
      { name: 'Onion', quantity: 1, unit: 'large', description: 'Diced' },
      { name: 'Bell pepper', quantity: 1, unit: 'whole', description: 'Diced' },
      { name: 'Kidney beans', quantity: 2, unit: 'cans', description: 'Rinsed' },
      { name: 'Crushed tomatoes', quantity: 1, unit: 'can', description: '28-ounce can' },
      { name: 'Vegetable broth', quantity: 2, unit: 'cups', description: 'Low sodium' },
      { name: 'Chili powder', quantity: 2, unit: 'tbsp', description: 'Smoky blend' },
      { name: 'Garlic', quantity: 3, unit: 'cloves', description: 'Minced' },
    ],
  },
  {
    id: 105,
    externalId: '52940',
    name: 'Strawberry Tart',
    category: 'Dessert',
    cuisine: 'French',
    imageUrl:
      'https://images.unsplash.com/photo-1464306076886-da185f6a9d05?auto=format&fit=crop&w=900&q=80',
    description:
      'A bright dessert tart with pastry cream, fresh berries, and a glossy finish.',
    instructions: [
      'Blind-bake the tart shell until lightly golden.',
      'Fill with chilled pastry cream and smooth the surface.',
      'Arrange strawberries and brush with warmed jam.',
    ],
    ingredients: [
      { name: 'Tart shell', quantity: 1, unit: 'whole', description: 'Pre-baked shell' },
      { name: 'Strawberries', quantity: 2, unit: 'cups', description: 'Halved berries' },
      { name: 'Pastry cream', quantity: 2, unit: 'cups', description: 'Chilled filling' },
      { name: 'Apricot jam', quantity: 2, unit: 'tbsp', description: 'For glaze' },
    ],
  },
  {
    id: 106,
    externalId: '53049',
    name: 'Miso Salmon Bowls',
    category: 'Dinner',
    cuisine: 'Japanese',
    imageUrl:
      'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=900&q=80',
    description:
      'Roasted salmon bowls with sesame rice, cucumbers, and a fast miso glaze.',
    instructions: [
      'Whisk miso, soy sauce, rice vinegar, and honey into a quick glaze.',
      'Roast salmon until flaky and lacquered.',
      'Serve over rice with cucumbers, avocado, and scallions.',
    ],
    ingredients: [
      { name: 'Salmon fillets', quantity: 4, unit: 'whole', description: 'Skin-on portions' },
      { name: 'White rice', quantity: 2, unit: 'cups', description: 'Cooked rice' },
      { name: 'Cucumber', quantity: 1, unit: 'whole', description: 'Thinly sliced' },
      { name: 'Avocado', quantity: 1, unit: 'whole', description: 'Sliced' },
      { name: 'White miso', quantity: 2, unit: 'tbsp', description: 'Savory paste' },
      { name: 'Soy sauce', quantity: 2, unit: 'tbsp', description: 'Low sodium' },
      { name: 'Scallions', quantity: 3, unit: 'whole', description: 'Thinly sliced' },
    ],
  },
]

export const seedSavedRecipes = [
  { userId: 1, recipeId: 101, isFavorite: 1 },
  { userId: 1, recipeId: 104, isFavorite: 0 },
  { userId: 1, recipeId: 105, isFavorite: 1 },
]

export const seedRecipeNotes = [
  { userId: 1, recipeId: 101, note: 'Serve with naan and cucumber salad.' },
  { userId: 1, recipeId: 105, note: 'Try raspberries next time for extra tartness.' },
]

export const seedReviews = [
  { userId: 1, recipeId: 101, rating: 5, review: 'Comforting and weeknight-friendly.' },
  { userId: 2, recipeId: 101, rating: 4, review: 'Great spice balance.' },
  { userId: 1, recipeId: 104, rating: 4, review: 'Easy pantry dinner.' },
]

export const seedGroceryLists = [
  {
    id: 1,
    userId: 1,
    name: 'Weekly Groceries',
    description: 'Staples for this week’s dinners',
    createdAt: '2026-04-19 18:00:00',
    updatedAt: '2026-04-22 09:10:00',
    items: [
      { ingredient: 'Chicken thighs', quantity: 1.5, unit: 'lb', purchased: 1, note: 'Buy boneless if on sale' },
      { ingredient: 'Onion', quantity: 2, unit: 'whole', purchased: 0, note: '' },
      { ingredient: 'Garlic', quantity: 7, unit: 'cloves', purchased: 0, note: '' },
      { ingredient: 'Kidney beans', quantity: 2, unit: 'cans', purchased: 1, note: '' },
      { ingredient: 'Crushed tomatoes', quantity: 1, unit: 'can', purchased: 0, note: '' },
    ],
  },
  {
    id: 2,
    userId: 1,
    name: 'Dessert Run',
    description: 'Ingredients for brunch sweets',
    createdAt: '2026-04-14 12:20:00',
    updatedAt: '2026-04-14 12:20:00',
    items: [
      { ingredient: 'Strawberries', quantity: 2, unit: 'cups', purchased: 0, note: 'Look for ripe berries' },
      { ingredient: 'Pastry cream', quantity: 2, unit: 'cups', purchased: 0, note: '' },
      { ingredient: 'Apricot jam', quantity: 2, unit: 'tbsp', purchased: 0, note: '' },
    ],
  },
]
