import test from 'node:test'
import assert from 'node:assert/strict'
import { salesService } from '../lib/services/sales.service'
import { purchasesService } from '../lib/services/purchases.service'
import { ordersService } from '../lib/services/orders.service'

test('Services: salesService rejects empty cart or invalid product quantities', async () => {
  await assert.rejects(
    async () => {
      await salesService.createSale({
        outletId: 1,
        userId: 1,
        items: [],
      })
    },
    { message: 'Cart is empty' }
  )

  await assert.rejects(
    async () => {
      await salesService.createSale({
        outletId: 1,
        userId: 1,
        items: [{ productId: 1, quantity: -5 }],
      })
    },
    { message: 'Invalid product or quantity specified in cart' }
  )

  await assert.rejects(
    async () => {
      await salesService.createSale({
        outletId: 1,
        userId: 1,
        items: [{ productId: 1, quantity: 2.7 }],
      })
    },
    { message: 'Invalid product or quantity specified in cart' }
  )
})

test('Services: purchasesService enforces paid amount bounds', async () => {
  await assert.rejects(
    async () => {
      await purchasesService.createPurchase({
        outletId: 1,
        supplierId: 1,
        total: 1000,
        paid: 5000, // exceeds total!
      })
    },
    { message: 'Paid amount must be between 0 and the total bill amount' }
  )

  await assert.rejects(
    async () => {
      await purchasesService.createPurchase({
        outletId: 1,
        supplierId: 1,
        total: 1000,
        paid: -100, // negative paid!
      })
    },
    { message: 'Paid amount must be between 0 and the total bill amount' }
  )
})

test('Services: ordersService rejects missing customer name, empty items, or negative amounts', async () => {
  await assert.rejects(
    async () => {
      await ordersService.createOrder({
        outletId: 1,
        userId: 1,
        customerName: '',
        items: [{ name: 'Cake', quantity: 1, price: 500 }],
      })
    },
    { message: 'Customer name and items are required' }
  )

  await assert.rejects(
    async () => {
      await ordersService.createOrder({
        outletId: 1,
        userId: 1,
        customerName: 'Aayush',
        items: [],
      })
    },
    { message: 'Customer name and items are required' }
  )

  await assert.rejects(
    async () => {
      await ordersService.createOrder({
        outletId: 1,
        userId: 1,
        customerName: 'Aayush',
        items: [{ name: 'Cake', quantity: -1, price: 500 }],
      })
    },
    { message: 'Item quantity must be a positive number' }
  )

  await assert.rejects(
    async () => {
      await ordersService.createOrder({
        outletId: 1,
        userId: 1,
        customerName: 'Aayush',
        items: [{ name: 'Cake', quantity: 1, price: -500 }],
      })
    },
    { message: 'Item price must be a non-negative number' }
  )

  await assert.rejects(
    async () => {
      await ordersService.createOrder({
        outletId: 1,
        userId: 1,
        customerName: 'Aayush',
        items: [{ name: 'Cake', quantity: 1, price: 500 }],
        advancePaid: -100,
      })
    },
    { message: 'Advance paid must be a non-negative number' }
  )

  await assert.rejects(
    async () => {
      await ordersService.createOrder({
        outletId: 1,
        userId: 1,
        customerName: 'Aayush',
        items: [{ name: 'Cake', quantity: 1, price: 500 }],
        advancePaid: 1000,
      })
    },
    { message: 'Advance paid cannot exceed the total order amount' }
  )
})
