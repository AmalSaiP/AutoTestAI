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

    // Create team_members table if it doesn't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS team_members (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        user_id TEXT NOT NULL,
        team_owner_id TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        status TEXT DEFAULT 'active',
        invited_at TEXT DEFAULT (datetime('now')),
        joined_at TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (team_owner_id) REFERENCES users(id),
        UNIQUE(user_id, team_owner_id)
      )
    `)

    // Get team members for the current user's team
    const members = db
      .prepare(`
      SELECT 
        u.id,
        u.name,
        u.email,
        u.role as user_role,
        tm.role,
        tm.status,
        u.created_at,
        u.updated_at as last_login,
        COUNT(DISTINCT p.id) as projects_count,
        COUNT(DISTINCT tc.id) as tests_generated
      FROM users u
      LEFT JOIN team_members tm ON u.id = tm.user_id AND tm.team_owner_id = ?
      LEFT JOIN projects p ON u.id = p.user_id
      LEFT JOIN test_cases tc ON u.id = tc.created_by
      WHERE u.id = ? OR tm.team_owner_id = ?
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `)
      .all(decoded.id, decoded.id, decoded.id)

    return NextResponse.json({
      members,
    })
  } catch (error) {
    console.error("Team fetch error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
