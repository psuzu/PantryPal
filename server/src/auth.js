import './env.js'
import crypto from 'node:crypto'
import { promisify } from 'node:util'

const scryptAsync = promisify(crypto.scrypt)
const PASSWORD_HASH_PREFIX = 'scrypt'
const PASSWORD_KEY_LENGTH = 64
const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 7
const tokenSecret = process.env.AUTH_TOKEN_SECRET || process.env.DB_PASSWORD

if (!tokenSecret) {
  throw new Error('Missing AUTH_TOKEN_SECRET or DB_PASSWORD for token signing.')
}

function encodeBase64Url(value) {
  return Buffer.from(value).toString('base64url')
}

function decodeBase64Url(value) {
  return Buffer.from(value, 'base64url').toString('utf8')
}

function safeCompare(left, right) {
  const leftBuffer = Buffer.from(String(left))
  const rightBuffer = Buffer.from(String(right))

  if (leftBuffer.length !== rightBuffer.length) {
    return false
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer)
}

export function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 8) {
    throw new Error('Password must be at least 8 characters long.')
  }
}

export function isPasswordHash(value) {
  return typeof value === 'string' && value.startsWith(`${PASSWORD_HASH_PREFIX}$`)
}

export async function hashPassword(password) {
  validatePassword(password)

  const salt = crypto.randomBytes(16).toString('hex')
  const derivedKey = await scryptAsync(password, salt, PASSWORD_KEY_LENGTH)

  return `${PASSWORD_HASH_PREFIX}$${salt}$${Buffer.from(derivedKey).toString('hex')}`
}

export async function verifyPassword(password, storedPassword) {
  if (typeof password !== 'string' || typeof storedPassword !== 'string') {
    return false
  }

  if (!isPasswordHash(storedPassword)) {
    return safeCompare(password, storedPassword)
  }

  const [, salt, expectedHash] = storedPassword.split('$')
  if (!salt || !expectedHash) {
    return false
  }

  const derivedKey = await scryptAsync(password, salt, PASSWORD_KEY_LENGTH)
  return safeCompare(Buffer.from(derivedKey).toString('hex'), expectedHash)
}

export function createAuthToken(user) {
  const payload = {
    sub: Number(user.id),
    exp: Date.now() + TOKEN_TTL_MS,
  }
  const encodedPayload = encodeBase64Url(JSON.stringify(payload))
  const signature = crypto
    .createHmac('sha256', tokenSecret)
    .update(encodedPayload)
    .digest('base64url')

  return `${encodedPayload}.${signature}`
}

export function verifyAuthToken(token) {
  const [encodedPayload, signature] = String(token || '').split('.')
  if (!encodedPayload || !signature) {
    throw new Error('Invalid token format.')
  }

  const expectedSignature = crypto
    .createHmac('sha256', tokenSecret)
    .update(encodedPayload)
    .digest('base64url')

  if (!safeCompare(signature, expectedSignature)) {
    throw new Error('Invalid token signature.')
  }

  const payload = JSON.parse(decodeBase64Url(encodedPayload))
  if (!Number.isInteger(payload.sub) || payload.exp <= Date.now()) {
    throw new Error('Token expired or malformed.')
  }

  return { id: payload.sub }
}

export function buildAuthResponse(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    token: createAuthToken(user),
  }
}