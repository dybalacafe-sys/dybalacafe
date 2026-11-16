import test from 'node:test'
import assert from 'node:assert/strict'
import {
  signToken,
  verifyToken,
  hashPassword,
  comparePassword,
  JWTPayload,
} from '../lib/auth'
import { DEFAULT_PERMISSIONS } from '../lib/permissions'

test('Auth: signToken and verifyToken round-trip JWT claims accurately', () => {
  const payload: JWTPayload = {
    userId: 42,
    email: 'test@dybala.com',
    role: 'ADMIN',
    name: 'Test Admin',
    permissions: DEFAULT_PERMISSIONS,
  }

  const token = signToken(payload)
  assert.ok(typeof token === 'string' && token.length > 20)

  const decoded = verifyToken(token)
  assert.equal(decoded.userId, 42)
  assert.equal(decoded.email, 'test@dybala.com')
  assert.equal(decoded.role, 'ADMIN')
  assert.equal(decoded.name, 'Test Admin')
})

test('Auth: verifyToken rejects invalid or tampered tokens', () => {
  assert.throws(() => verifyToken('invalid.jwt.token'))
  assert.throws(() => verifyToken(''))
})

test('Auth: password hashing and comparison with bcrypt', async () => {
  const raw = 'SecureSecretPassword2026!'
  const hashed = await hashPassword(raw)

  assert.notEqual(raw, hashed)
  assert.ok(hashed.startsWith('$2'))

  const isMatch = await comparePassword(raw, hashed)
  assert.equal(isMatch, true)

  const isWrongMatch = await comparePassword('WrongPassword', hashed)
  assert.equal(isWrongMatch, false)
})
