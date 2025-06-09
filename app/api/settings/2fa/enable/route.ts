import { type NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/auth"
import { getDatabase } from "@/lib/database"

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization")

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No token provided" }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const decoded = verifyToken(token)

    if (!decoded) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    const db = getDatabase()

    // Create 2FA secrets table if it doesn't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_2fa (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        user_id TEXT UNIQUE NOT NULL,
        secret TEXT NOT NULL,
        backup_codes TEXT,
        enabled BOOLEAN DEFAULT FALSE,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `)

    // Generate a mock secret (in real app, use speakeasy or similar)
    const secret = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    const backupCodes = Array.from({ length: 10 }, () => Math.random().toString(36).substring(2, 8).toUpperCase())

    // Store 2FA secret
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO user_2fa (user_id, secret, backup_codes, enabled)
      VALUES (?, ?, ?, ?)
    `)

    stmt.run(decoded.id, secret, JSON.stringify(backupCodes), false)

    // Generate QR code URL (mock)
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=otpauth://totp/AutoTestAI:${decoded.email}?secret=${secret}&issuer=AutoTestAI`

    return NextResponse.json({
      secret,
      qrCodeUrl,
      backupCodes,
      message: "2FA setup initiated. Scan the QR code with your authenticator app.",
    })
  } catch (error) {
    console.error("2FA enable error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
