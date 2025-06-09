import { type NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/auth"
import { getDatabase, generateId } from "@/lib/database"

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

    // Create reports table if it doesn't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS reports (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        name TEXT NOT NULL,
        description TEXT,
        type TEXT NOT NULL,
        format TEXT NOT NULL,
        schedule TEXT NOT NULL,
        filters TEXT NOT NULL,
        created_by TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        last_generated TEXT,
        status TEXT DEFAULT 'active',
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `)

    const reports = db
      .prepare(`
      SELECT * FROM reports 
      WHERE created_by = ? 
      ORDER BY created_at DESC
    `)
      .all(decoded.id)

    // Parse filters JSON for each report
    const processedReports = reports.map((report: any) => ({
      ...report,
      filters: JSON.parse(report.filters || "{}"),
    }))

    return NextResponse.json({
      reports: processedReports,
    })
  } catch (error) {
    console.error("Reports fetch error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

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

    const { name, description, type, format, schedule, filters } = await request.json()

    if (!name || !type || !format || !schedule) {
      return NextResponse.json({ error: "Required fields missing" }, { status: 400 })
    }

    const db = getDatabase()
    const id = generateId()

    const stmt = db.prepare(`
      INSERT INTO reports (id, name, description, type, format, schedule, filters, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(id, name, description || "", type, format, schedule, JSON.stringify(filters || {}), decoded.id)

    const report = db.prepare("SELECT * FROM reports WHERE id = ?").get(id) as any

    return NextResponse.json({
      report: {
        ...report,
        filters: JSON.parse(report.filters || "{}"),
      },
      message: "Report created successfully",
    })
  } catch (error) {
    console.error("Report creation error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
