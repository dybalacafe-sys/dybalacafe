/**
 * Seed Menu, Raw Materials, Recipes & Stock
 * -------------------------------------------------------------
 * Sets up categories, ingredients, finished products with recipes,
 * and provisions baseline outlet stock levels.
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export const CATEGORIES: { name: string; type: string }[] = [
  { name: 'Beverages', type: 'product' },
  { name: 'Food', type: 'product' },
  { name: 'Bakery', type: 'product' },
  { name: 'Cakes', type: 'product' },
  { name: 'Raw Materials', type: 'raw_material' },
  { name: 'Packaging', type: 'raw_material' },
  { name: 'Utilities', type: 'raw_material' },
]

export const RAW_MATERIALS = [
  { sku: 'RM-COFFEE', name: 'Coffee', category: 'Raw Materials', unit: 'g', costPrice: 5.4, minStock: 200, defaultStock: 2500 },
  { sku: 'RM-SUGAR', name: 'Sugar', category: 'Raw Materials', unit: 'g', costPrice: 0.13, minStock: 1000, defaultStock: 15000 },
  { sku: 'RM-MILK', name: 'Milk', category: 'Raw Materials', unit: 'ml', costPrice: 0.08, minStock: 2000, defaultStock: 12000 },
  { sku: 'RM-TEA', name: 'Tea Leaves (Chiya Rang)', category: 'Raw Materials', unit: 'g', costPrice: 0.8, minStock: 200, defaultStock: 1800 },
  { sku: 'RM-LEMON', name: 'Lemon', category: 'Raw Materials', unit: 'piece', costPrice: 10, minStock: 15, defaultStock: 60 },
  { sku: 'RM-CABBAGE', name: 'Cabbage', category: 'Raw Materials', unit: 'kg', costPrice: 40, minStock: 5, defaultStock: 35 },
  { sku: 'RM-ONION', name: 'Onion', category: 'Raw Materials', unit: 'kg', costPrice: 80, minStock: 5, defaultStock: 25 },
  { sku: 'RM-GINGER', name: 'Ginger', category: 'Raw Materials', unit: 'g', costPrice: 0.3, minStock: 200, defaultStock: 1200 },
  { sku: 'RM-BUTTER', name: 'Butter', category: 'Raw Materials', unit: 'g', costPrice: 1, minStock: 300, defaultStock: 2500 },
  { sku: 'RM-MAIDA', name: 'Maida (Flour)', category: 'Raw Materials', unit: 'kg', costPrice: 60, minStock: 10, defaultStock: 50 },
  { sku: 'RM-BUN', name: 'Burger Bun', category: 'Raw Materials', unit: 'piece', costPrice: 13, minStock: 15, defaultStock: 45 },
  { sku: 'RM-PATTY', name: 'Veg Patty', category: 'Raw Materials', unit: 'piece', costPrice: 25, minStock: 15, defaultStock: 40 },
  { sku: 'RM-VEG', name: 'Veg Filling', category: 'Raw Materials', unit: 'g', costPrice: 0.5, minStock: 500, defaultStock: 4000 },
  { sku: 'RM-SAUCE', name: 'Sauce', category: 'Raw Materials', unit: 'ml', costPrice: 1, minStock: 300, defaultStock: 3000 },
  { sku: 'RM-PIZZA-BASE', name: 'Pizza Base', category: 'Raw Materials', unit: 'piece', costPrice: 100, minStock: 8, defaultStock: 30 },
  { sku: 'RM-CREAM', name: 'Cream', category: 'Raw Materials', unit: 'g', costPrice: 0.28, minStock: 500, defaultStock: 5000 },
  { sku: 'RM-CAKE-BASE', name: 'Cake Base', category: 'Raw Materials', unit: 'piece', costPrice: 10, minStock: 10, defaultStock: 35 },
  { sku: 'RM-PREMIX', name: 'Cake Premix (Sponge)', category: 'Raw Materials', unit: 'portion', costPrice: 80, minStock: 10, defaultStock: 40 },
  { sku: 'RM-OIL', name: 'Cooking Oil', category: 'Raw Materials', unit: 'portion', costPrice: 10, minStock: 10, defaultStock: 40 },
  { sku: 'RM-SUGAR-SYRUP', name: 'Sugar Syrup', category: 'Raw Materials', unit: 'portion', costPrice: 10, minStock: 10, defaultStock: 50 },
  { sku: 'RM-CAKE-BOX', name: 'Cake Box', category: 'Packaging', unit: 'piece', costPrice: 20, minStock: 15, defaultStock: 50 },
  { sku: 'RM-PIZZA-PACK', name: 'Pizza Pack', category: 'Packaging', unit: 'piece', costPrice: 20, minStock: 15, defaultStock: 40 },
  { sku: 'RM-PASTRY-BOX', name: 'Pastry Box', category: 'Packaging', unit: 'piece', costPrice: 5, minStock: 20, defaultStock: 80 },
  { sku: 'RM-GAS', name: 'Gas (& Electricity)', category: 'Utilities', unit: 'use', costPrice: 1, minStock: 0, defaultStock: 250 },
  { sku: 'RM-MISC-PREP', name: 'Misc Prep Ingredients', category: 'Utilities', unit: 'use', costPrice: 40, minStock: 0, defaultStock: 50 },
]

export const FINISHED = [
  {
    sku: 'FG-BLACK-COFFEE', name: 'Black Coffee', category: 'Beverages', unit: 'cup', price: 90, defaultStock: 60,
    recipe: [
      { sku: 'RM-COFFEE', qty: 5, unit: 'g' },
      { sku: 'RM-SUGAR', qty: 10, unit: 'g' },
      { sku: 'RM-GAS', qty: 5, unit: 'use' },
    ],
  },
  {
    sku: 'FG-MILK-COFFEE', name: 'Milk Coffee', category: 'Beverages', unit: 'cup', price: 140, defaultStock: 55,
    recipe: [
      { sku: 'RM-MILK', qty: 150, unit: 'ml' },
      { sku: 'RM-COFFEE', qty: 5, unit: 'g' },
      { sku: 'RM-SUGAR', qty: 10, unit: 'g' },
    ],
  },
  {
    sku: 'FG-MILK-TEA', name: 'Milk Tea', category: 'Beverages', unit: 'cup', price: 60, defaultStock: 80,
    recipe: [
      { sku: 'RM-MILK', qty: 100, unit: 'ml' },
      { sku: 'RM-TEA', qty: 5, unit: 'g' },
      { sku: 'RM-SUGAR', qty: 10, unit: 'g' },
    ],
  },
  {
    sku: 'FG-BLACK-TEA', name: 'Black Tea', category: 'Beverages', unit: 'cup', price: 50, defaultStock: 75,
    recipe: [
      { sku: 'RM-TEA', qty: 3, unit: 'g' },
      { sku: 'RM-SUGAR', qty: 10, unit: 'g' },
      { sku: 'RM-LEMON', qty: 0.5, unit: 'piece' },
    ],
  },
  {
    sku: 'FG-MOMO', name: 'Momo (Veg, 1 plate)', category: 'Food', unit: 'plate', price: 180, defaultStock: 35,
    recipe: [
      { sku: 'RM-CABBAGE', qty: 0.3, unit: 'kg' },
      { sku: 'RM-ONION', qty: 0.1, unit: 'kg' },
      { sku: 'RM-GINGER', qty: 5, unit: 'g' },
      { sku: 'RM-BUTTER', qty: 5, unit: 'g' },
      { sku: 'RM-MAIDA', qty: 0.1, unit: 'kg' },
      { sku: 'RM-MISC-PREP', qty: 0.1, unit: 'use' },
      { sku: 'RM-GAS', qty: 2, unit: 'use' },
    ],
  },
  {
    sku: 'FG-VEG-BURGER', name: 'Veg Burger', category: 'Food', unit: 'piece', price: 175, defaultStock: 25,
    recipe: [
      { sku: 'RM-BUN', qty: 1, unit: 'piece' },
      { sku: 'RM-PATTY', qty: 1, unit: 'piece' },
      { sku: 'RM-VEG', qty: 20, unit: 'g' },
      { sku: 'RM-BUTTER', qty: 5, unit: 'g' },
      { sku: 'RM-SAUCE', qty: 10, unit: 'ml' },
      { sku: 'RM-GAS', qty: 10, unit: 'use' },
    ],
  },
  {
    sku: 'FG-VEG-PIZZA', name: 'Veg Pizza', category: 'Food', unit: 'piece', price: 380, defaultStock: 18,
    recipe: [
      { sku: 'RM-PIZZA-BASE', qty: 1, unit: 'piece' },
      { sku: 'RM-VEG', qty: 40, unit: 'g' },
      { sku: 'RM-GAS', qty: 10, unit: 'use' },
      { sku: 'RM-PIZZA-PACK', qty: 1, unit: 'piece' },
    ],
  },
  {
    sku: 'FG-CAKE', name: 'Cake (1 Pound)', category: 'Cakes', unit: 'piece', price: 850, defaultStock: 6,
    recipe: [
      { sku: 'RM-PREMIX', qty: 1, unit: 'portion' },
      { sku: 'RM-OIL', qty: 1, unit: 'portion' },
      { sku: 'RM-GAS', qty: 10, unit: 'use' },
      { sku: 'RM-SUGAR-SYRUP', qty: 1, unit: 'portion' },
      { sku: 'RM-CREAM', qty: 250, unit: 'g' },
      { sku: 'RM-CAKE-BASE', qty: 1, unit: 'piece' },
      { sku: 'RM-CAKE-BOX', qty: 1, unit: 'piece' },
    ],
  },
  {
    sku: 'FG-PASTRY', name: 'Pastry', category: 'Bakery', unit: 'piece', price: 120, defaultStock: 24,
    recipe: [
      { sku: 'RM-PREMIX', qty: 1, unit: 'portion' },
      { sku: 'RM-OIL', qty: 1, unit: 'portion' },
      { sku: 'RM-GAS', qty: 10, unit: 'use' },
      { sku: 'RM-SUGAR-SYRUP', qty: 1, unit: 'portion' },
      { sku: 'RM-CREAM', qty: 50, unit: 'g' },
      { sku: 'RM-CAKE-BASE', qty: 1, unit: 'piece' },
      { sku: 'RM-PASTRY-BOX', qty: 1, unit: 'piece' },
    ],
  },
]

export async function seedInventory(client: PrismaClient = prisma) {
  console.log('📦 Seeding Menu, Categories, Raw Materials & Recipes...')

  const outlets = await client.outlet.findMany({ where: { active: true } })
  const cafe = outlets.find((o) => o.code === 'CAF')

  // 1. Categories
  for (const c of CATEGORIES) {
    await client.category.upsert({
      where: { name: c.name },
      update: { type: c.type },
      create: c,
    })
  }
  const categories = await client.category.findMany()
  const catId = (name: string) => categories.find((c) => c.name === name)?.id

  // 2. Raw Materials
  const rawCost: Record<string, number> = {}
  for (const rm of RAW_MATERIALS) {
    rawCost[rm.sku] = rm.costPrice
    const product = await client.product.upsert({
      where: { sku: rm.sku },
      update: {
        name: rm.name,
        categoryId: catId(rm.category),
        type: 'raw_material',
        unit: rm.unit,
        costPrice: rm.costPrice,
        price: rm.costPrice,
        active: true,
      },
      create: {
        sku: rm.sku,
        name: rm.name,
        categoryId: catId(rm.category),
        type: 'raw_material',
        unit: rm.unit,
        costPrice: rm.costPrice,
        price: rm.costPrice,
        active: true,
      },
    })

    for (const outlet of outlets) {
      await client.outletProduct.upsert({
        where: { outletId_productId: { outletId: outlet.id, productId: product.id } },
        update: { stock: rm.defaultStock, minStock: rm.minStock },
        create: {
          outletId: outlet.id,
          productId: product.id,
          stock: rm.defaultStock,
          minStock: rm.minStock,
        },
      })
    }
  }

  // 3. Finished Goods + Recipes
  const seededProducts: any[] = []
  for (const fg of FINISHED) {
    const costPrice = Number(
      fg.recipe.reduce((sum, line) => sum + line.qty * (rawCost[line.sku] ?? 0), 0).toFixed(2)
    )

    const product = await client.product.upsert({
      where: { sku: fg.sku },
      update: {
        name: fg.name,
        categoryId: catId(fg.category),
        type: 'finished',
        unit: fg.unit,
        costPrice,
        price: fg.price,
        active: true,
      },
      create: {
        sku: fg.sku,
        name: fg.name,
        categoryId: catId(fg.category),
        type: 'finished',
        unit: fg.unit,
        costPrice,
        price: fg.price,
        active: true,
      },
    })
    seededProducts.push(product)

    await client.recipeItem.deleteMany({ where: { productId: product.id } })
    for (const line of fg.recipe) {
      const ingredient = await client.product.findUnique({ where: { sku: line.sku } })
      if (ingredient) {
        await client.recipeItem.create({
          data: {
            productId: product.id,
            ingredientId: ingredient.id,
            quantity: line.qty,
            unit: line.unit,
          },
        })
      }
    }

    for (const outlet of outlets) {
      const outletStock = cafe && outlet.id === cafe.id ? Math.floor(fg.defaultStock * 0.8) : fg.defaultStock
      await client.outletProduct.upsert({
        where: { outletId_productId: { outletId: outlet.id, productId: product.id } },
        update: { stock: outletStock, price: fg.price },
        create: {
          outletId: outlet.id,
          productId: product.id,
          stock: outletStock,
          minStock: 5,
          price: fg.price,
        },
      })
    }
  }

  console.log(`   ✔ ${RAW_MATERIALS.length} Raw Materials and ${FINISHED.length} Finished Items seeded with stock & recipes.`)
  return { seededProducts }
}

// Standalone execution support
if (require.main === module || process.argv[1]?.endsWith('03-inventory.ts')) {
  seedInventory()
    .catch((e) => {
      console.error('❌ Failed seeding inventory:', e)
      process.exit(1)
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}
