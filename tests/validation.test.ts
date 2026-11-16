import test from 'node:test'
import assert from 'node:assert/strict'
import { validators, ValidationError } from '../lib/validation'

test('Validation: positiveInt validates whole numbers and rejects floats/negatives', () => {
  assert.equal(validators.positiveInt(5, 'Quantity'), 5)
  assert.equal(validators.positiveInt('10', 'Quantity'), 10)

  assert.throws(() => validators.positiveInt(0, 'Quantity'), ValidationError)
  assert.throws(() => validators.positiveInt(-3, 'Quantity'), ValidationError)
  assert.throws(() => validators.positiveInt(3.5, 'Quantity'), ValidationError)
  assert.throws(() => validators.positiveInt('abc', 'Quantity'), ValidationError)
})

test('Validation: nonNegativeNumber permits zero and positive decimals', () => {
  assert.equal(validators.nonNegativeNumber(0, 'Discount'), 0)
  assert.equal(validators.nonNegativeNumber(12.5, 'Price'), 12.5)
  assert.equal(validators.nonNegativeNumber('450', 'Total'), 450)

  assert.throws(() => validators.nonNegativeNumber(-1, 'Price'), ValidationError)
  assert.throws(() => validators.nonNegativeNumber(NaN, 'Price'), ValidationError)
})

test('Validation: email validates standard formats and normalizes case', () => {
  assert.equal(validators.email('ADMIN@DYBALA.COM'), 'admin@dybala.com')
  assert.equal(validators.email('user.test+1@example.co.uk'), 'user.test+1@example.co.uk')

  assert.throws(() => validators.email('invalid-email'), ValidationError)
  assert.throws(() => validators.email('test@'), ValidationError)
  assert.throws(() => validators.email(''), ValidationError)
})

test('Validation: enum enforces allowed string sets', () => {
  const allowed = ['cash', 'card', 'fonepay'] as const
  assert.equal(validators.enum('cash', allowed, 'PaymentMethod'), 'cash')
  assert.equal(validators.enum('fonepay', allowed, 'PaymentMethod'), 'fonepay')

  assert.throws(() => validators.enum('bitcoin', allowed, 'PaymentMethod'), ValidationError)
})
