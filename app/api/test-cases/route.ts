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

    const testCases = db
      .prepare(`
      SELECT 
        tc.*,
        p.name as project_name
      FROM test_cases tc
      LEFT JOIN projects p ON tc.project_id = p.id
      WHERE tc.created_by = ?
      ORDER BY tc.created_at DESC
    `)
      .all(decoded.id)

    return NextResponse.json({
      testCases,
    })
  } catch (error) {
    console.error("Test cases fetch error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
