import { type NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/auth"
import { getDatabase } from "@/lib/database"

export async function GET(request: NextRequest) {
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

    // Create user_settings table if it doesn't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_settings (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        user_id TEXT UNIQUE NOT NULL,
        profile_settings TEXT DEFAULT '{}',
        notification_settings TEXT DEFAULT '{}',
        security_settings TEXT DEFAULT '{}',
        preference_settings TEXT DEFAULT '{}',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `)

    // Get user info
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(decoded.id) as any

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Get or create user settings
    let userSettings = db.prepare("SELECT * FROM user_settings WHERE user_id = ?").get(decoded.id) as any

    if (!userSettings) {
      // Create default settings
      const defaultSettings = {
        profile_settings: JSON.stringify({
          name: user.name,
          email: user.email,
          company: "",
          timezone: "UTC",
          language: "en",
        }),
        notification_settings: JSON.stringify({
          email_reports: true,
          email_failures: true,
          email_weekly_summary: false,
          push_notifications: true,
          slack_integration: false,
          webhook_url: "",
        }),
        security_settings: JSON.stringify({
          two_factor_enabled: false,
          session_timeout: 24,
          password_expiry: 90,
          login_notifications: true,
        }),
        preference_settings: JSON.stringify({
          default_environment: "development",
          default_test_type: "bdd",
          auto_execute: false,
          dark_mode: false,
          compact_view: false,
        }),
      }

      const stmt = db.prepare(`
        INSERT INTO user_settings (user_id, profile_settings, notification_settings, security_settings, preference_settings)
        VALUES (?, ?, ?, ?, ?)
      `)

      stmt.run(
        decoded.id,
        defaultSettings.profile_settings,
        defaultSettings.notification_settings,
        defaultSettings.security_settings,
        defaultSettings.preference_settings,
      )

      userSettings = db.prepare("SELECT * FROM user_settings WHERE user_id = ?").get(decoded.id) as any
    }

    const settings = {
      profile: JSON.parse(userSettings.profile_settings || "{}"),
      notifications: JSON.parse(userSettings.notification_settings || "{}"),
      security: JSON.parse(userSettings.security_settings || "{}"),
      preferences: JSON.parse(userSettings.preference_settings || "{}"),
    }

    return NextResponse.json({
      settings,
    })
  } catch (error) {
    console.error("Settings fetch error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
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

    const { profile, notifications, security, preferences } = await request.json()

    const db = getDatabase()

    // Update user_settings
    const stmt = db.prepare(`
      UPDATE user_settings 
      SET 
        profile_settings = ?,
        notification_settings = ?,
        security_settings = ?,
        preference_settings = ?,
        updated_at = datetime('now')
      WHERE user_id = ?
    `)

    stmt.run(
      JSON.stringify(profile || {}),
      JSON.stringify(notifications || {}),
      JSON.stringify(security || {}),
      JSON.stringify(preferences || {}),
      decoded.id,
    )

    // Update user profile in users table if profile data changed
    if (profile) {
      const userStmt = db.prepare(`
        UPDATE users 
        SET name = ?, email = ?, updated_at = datetime('now')
        WHERE id = ?
      `)
      userStmt.run(profile.name, profile.email, decoded.id)
    }

    return NextResponse.json({
      message: "Settings updated successfully",
    })
  } catch (error) {
    console.error("Settings update error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
