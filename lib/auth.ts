import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import { getDatabase, generateId } from "./database"
import type { User } from "./database"

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key"

export interface AuthUser {
  id: string
  email: string
  name: string
  role: string
  plan: string
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export function generateToken(user: AuthUser): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      plan: user.plan,
    },
    JWT_SECRET,
    { expiresIn: "7d" },
  )
}

export function verifyToken(token: string): AuthUser | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthUser
  } catch {
    return null
  }
}

export async function createUser(email: string, name: string, password: string): Promise<User> {
  const db = getDatabase()
  const passwordHash = await hashPassword(password)
  const id = generateId()

  const stmt = db.prepare(`
    INSERT INTO users (id, email, name, password_hash)
    VALUES (?, ?, ?, ?)
  `)

  stmt.run(id, email, name, passwordHash)

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as User
  return user
}

export async function authenticateUser(email: string, password: string): Promise<User | null> {
  const db = getDatabase()

  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as User | undefined

  if (!user) {
    return null
  }

  const isValid = await verifyPassword(password, user.password_hash)
  return isValid ? user : null
}

export async function getUserById(id: string): Promise<User | null> {
  const db = getDatabase()
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as User | undefined
  return user || null
}
