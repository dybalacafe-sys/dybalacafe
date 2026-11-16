/**
 * Lightweight, zero-dependency schema validation utility for Next.js API routes.
 */

export class ValidationError extends Error {
  constructor(public errors: string[]) {
    super(errors.join(', '))
    this.name = 'ValidationError'
  }
}

export const validators = {
  string(val: unknown, fieldName: string, { minLength = 1, maxLength = 255 } = {}): string {
    if (typeof val !== 'string' || val.trim().length < minLength) {
      throw new ValidationError([`${fieldName} is required and must be at least ${minLength} characters`])
    }
    if (val.length > maxLength) {
      throw new ValidationError([`${fieldName} exceeds maximum length of ${maxLength} characters`])
    }
    return val.trim()
  },

  optionalString(val: unknown, fieldName: string, maxLength = 255): string | undefined {
    if (val === undefined || val === null || val === '') return undefined
    if (typeof val !== 'string') {
      throw new ValidationError([`${fieldName} must be a string`])
    }
    if (val.length > maxLength) {
      throw new ValidationError([`${fieldName} exceeds maximum length of ${maxLength} characters`])
    }
    return val.trim()
  },

  positiveInt(val: unknown, fieldName: string): number {
    const num = Number(val)
    if (isNaN(num) || !Number.isInteger(num) || num <= 0) {
      throw new ValidationError([`${fieldName} must be a positive whole number`])
    }
    return num
  },

  nonNegativeNumber(val: unknown, fieldName: string): number {
    const num = Number(val)
    if (isNaN(num) || !Number.isFinite(num) || num < 0) {
      throw new ValidationError([`${fieldName} must be a non-negative number`])
    }
    return num
  },

  email(val: unknown, fieldName = 'Email'): string {
    const str = validators.string(val, fieldName)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(str)) {
      throw new ValidationError([`${fieldName} must be a valid email address`])
    }
    return str.toLowerCase()
  },

  isoDate(val: unknown, fieldName = 'Date'): Date {
    if (!val) return new Date()
    const d = new Date(val as string)
    if (isNaN(d.getTime())) {
      throw new ValidationError([`${fieldName} must be a valid date`])
    }
    return d
  },

  enum<T extends string>(val: unknown, allowed: readonly T[], fieldName: string): T {
    if (typeof val !== 'string' || !allowed.includes(val as T)) {
      throw new ValidationError([`${fieldName} must be one of: ${allowed.join(', ')}`])
    }
    return val as T
  },
}
