import Database from "better-sqlite3"
import path from "path"

// SQLite database connection
const dbPath = path.join(process.cwd(), "data", "autotest.db")
let db: Database.Database

// Initialize database connection
export function getDatabase() {
  if (!db) {
    // Ensure data directory exists
    const fs = require("fs")
    const dataDir = path.dirname(dbPath)
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true })
    }

    db = new Database(dbPath)
    db.pragma("journal_mode = WAL")
  }
  return db
}

// Database schema types
export interface User {
  id: string
  email: string
  name: string
  password_hash: string
  role: "admin" | "user" | "viewer"
  plan: "free" | "basic" | "pro" | "enterprise"
  created_at: string
  updated_at: string
}

export interface Project {
  id: string
  name: string
  description: string
  user_id: string
  created_at: string
  updated_at: string
}

export interface TestCase {
  id: string
  project_id: string
  name: string
  type: "bdd" | "unit" | "api" | "ui" | "performance"
  content: string
  input_source: string
  ai_model_used: string
  created_by: string
  metadata: string // JSON string with enhanced metadata
  created_at: string
  updated_at: string
}

export interface TestExecution {
  id: string
  test_case_id: string
  status: "running" | "passed" | "failed" | "skipped"
  duration: number
  environment: string
  triggered_by: string
  logs: string
  created_at: string
}

export interface AuditLog {
  id: string
  user_id: string
  action: string
  resource_type: string
  resource_id: string
  ip_address: string
  user_agent: string
  created_at: string
}

// Initialize database tables
export function initializeDatabase() {
  const database = getDatabase()

  try {
    // Users table
    database.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        plan TEXT DEFAULT 'free',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `)

    // Projects table
    database.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        name TEXT NOT NULL,
        description TEXT,
        user_id TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `)

    // Enhanced test cases table with metadata
    database.exec(`
      CREATE TABLE IF NOT EXISTS test_cases (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        project_id TEXT,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        input_source TEXT,
        ai_model_used TEXT,
        created_by TEXT NOT NULL,
        metadata TEXT DEFAULT '{}',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `)

    // Test executions table
    database.exec(`
      CREATE TABLE IF NOT EXISTS test_executions (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        test_case_id TEXT NOT NULL,
        status TEXT NOT NULL,
        duration INTEGER DEFAULT 0,
        environment TEXT,
        triggered_by TEXT NOT NULL,
        logs TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (test_case_id) REFERENCES test_cases(id) ON DELETE CASCADE,
        FOREIGN KEY (triggered_by) REFERENCES users(id)
      )
    `)

    // Audit logs table
    database.exec(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        user_id TEXT NOT NULL,
        action TEXT NOT NULL,
        resource_type TEXT,
        resource_id TEXT,
        ip_address TEXT,
        user_agent TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `)

    // Add indexes for better performance
    database.exec(`
      CREATE INDEX IF NOT EXISTS idx_test_cases_created_by ON test_cases(created_by);
      CREATE INDEX IF NOT EXISTS idx_test_cases_type ON test_cases(type);
      CREATE INDEX IF NOT EXISTS idx_test_executions_test_case_id ON test_executions(test_case_id);
      CREATE INDEX IF NOT EXISTS idx_test_executions_status ON test_executions(status);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
    `)

    // Add metadata column if it doesn't exist (for existing databases)
    try {
      database.exec(`ALTER TABLE test_cases ADD COLUMN metadata TEXT DEFAULT '{}'`)
    } catch (error) {
      // Column already exists, ignore error
    }

    console.log("Database initialized successfully with enhanced schema")
  } catch (error) {
    console.error("Database initialization error:", error)
    throw error
  }
}

// Helper functions for database operations
export function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}
