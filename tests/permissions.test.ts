import test from 'node:test'
import assert from 'node:assert/strict'
import {
  can,
  parsePermissions,
  DEFAULT_PERMISSIONS,
  FULL_PERMISSIONS,
  Permissions,
} from '../lib/permissions'

test('Permissions: SUPER_ADMIN always passes all checks', () => {
  const emptyPerms: Permissions = { ...DEFAULT_PERMISSIONS }
  assert.equal(can(emptyPerms, 'SUPER_ADMIN', 'pos', 'delete'), true)
  assert.equal(can(emptyPerms, 'SUPER_ADMIN', 'reports', 'view'), true)
  assert.equal(can(null, 'SUPER_ADMIN', 'users', 'edit'), true)
})

test('Permissions: STAFF with specific permissions succeeds or fails accurately', () => {
  const staffPerms: Permissions = {
    ...DEFAULT_PERMISSIONS,
    pos: { view: true, edit: true, delete: false },
    reports: { view: false, edit: false, delete: false },
  }

  // Allowed
  assert.equal(can(staffPerms, 'STAFF', 'pos', 'view'), true)
  assert.equal(can(staffPerms, 'STAFF', 'pos', 'edit'), true)

  // Denied
  assert.equal(can(staffPerms, 'STAFF', 'pos', 'delete'), false)
  assert.equal(can(staffPerms, 'STAFF', 'reports', 'view'), false)
  assert.equal(can(staffPerms, 'STAFF', 'users', 'view'), false)
})

test('Permissions: Null or undefined permissions safely denies non-superadmins', () => {
  assert.equal(can(null, 'STAFF', 'pos', 'view'), false)
  assert.equal(can(null, 'ADMIN', 'reports', 'view'), false)
})

test('Permissions: parsePermissions safely parses raw DB JSON or null', () => {
  const parsedNull = parsePermissions(null)
  assert.equal(parsedNull.pos.view, false)

  const rawJson = {
    pos: { view: true, edit: true },
    inventory: { view: true, edit: false, delete: false },
  }
  const parsed = parsePermissions(rawJson)
  assert.equal(parsed.pos.view, true)
  assert.equal(parsed.pos.edit, true)
  assert.equal(parsed.pos.delete, false)
  assert.equal(parsed.inventory.view, true)
  assert.equal(parsed.inventory.edit, false)
  assert.equal(parsed.reports.view, false)
})
