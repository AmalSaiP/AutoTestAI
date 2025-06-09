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

    const url = new URL(request.url)
    const timeRange = url.searchParams.get("timeRange") || "7d"
    const environment = url.searchParams.get("environment") || ""
    const testType = url.searchParams.get("testType") || ""

    const db = getDatabase()

    let whereClause = "WHERE tc.created_by = ?"
    const params = [decoded.id]

    if (environment) {
      whereClause += " AND te.environment = ?"
      params.push(environment)
    }

    if (testType) {
      whereClause += " AND tc.type = ?"
      params.push(testType)
    }

    // Add time range filter
    const days = Number.parseInt(timeRange.replace("d", ""))
    whereClause += " AND te.created_at >= datetime('now', '-' || ? || ' days')"
    params.push(days.toString())

    const results = db
      .prepare(`
      SELECT 
        te.*,
        tc.name as test_name,
        tc.type as test_type,
        p.name as project_name
      FROM test_executions te
      JOIN test_cases tc ON te.test_case_id = tc.id
      LEFT JOIN projects p ON tc.project_id = p.id
      ${whereClause}
      ORDER BY te.created_at DESC
    `)
      .all(...params)

    return NextResponse.json({
      results,
    })
  } catch (error) {
    console.error("Results fetch error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
