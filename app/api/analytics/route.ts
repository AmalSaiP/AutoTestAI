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

    // Get basic analytics
    const totalExecutions = db
      .prepare(`
      SELECT COUNT(*) as count
      FROM test_executions te
      JOIN test_cases tc ON te.test_case_id = tc.id
      ${whereClause}
    `)
      .get(...params) as { count: number }

    const passedExecutions = db
      .prepare(`
      SELECT COUNT(*) as count
      FROM test_executions te
      JOIN test_cases tc ON te.test_case_id = tc.id
      ${whereClause} AND te.status = 'passed'
    `)
      .get(...params) as { count: number }

    const avgDuration = db
      .prepare(`
      SELECT AVG(te.duration) as avg_duration
      FROM test_executions te
      JOIN test_cases tc ON te.test_case_id = tc.id
      ${whereClause}
    `)
      .get(...params) as { avg_duration: number }

    // Get trends data (last 7 days)
    const trendsData = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split("T")[0]

      const dayData = db
        .prepare(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN te.status = 'passed' THEN 1 ELSE 0 END) as passed,
          SUM(CASE WHEN te.status = 'failed' THEN 1 ELSE 0 END) as failed
        FROM test_executions te
        JOIN test_cases tc ON te.test_case_id = tc.id
        WHERE tc.created_by = ? AND DATE(te.created_at) = ?
      `)
        .get(decoded.id, dateStr) as { total: number; passed: number; failed: number }

      trendsData.push({
        date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        passed: dayData.passed || 0,
        failed: dayData.failed || 0,
        total: dayData.total || 0,
      })
    }

    // Get test type distribution
    const typeDistribution = db
      .prepare(`
      SELECT 
        tc.type,
        COUNT(*) as count
      FROM test_executions te
      JOIN test_cases tc ON te.test_case_id = tc.id
      ${whereClause}
      GROUP BY tc.type
    `)
      .all(...params) as Array<{ type: string; count: number }>

    const colors = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"]
    const processedTypeDistribution = typeDistribution.map((item, index) => ({
      name: item.type.toUpperCase(),
      value: item.count,
      color: colors[index % colors.length],
    }))

    // Get environment stats
    const environmentStats = db
      .prepare(`
      SELECT 
        te.environment,
        COUNT(*) as total,
        SUM(CASE WHEN te.status = 'passed' THEN 1 ELSE 0 END) as passed,
        SUM(CASE WHEN te.status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM test_executions te
      JOIN test_cases tc ON te.test_case_id = tc.id
      WHERE tc.created_by = ?
      GROUP BY te.environment
    `)
      .all(decoded.id) as Array<{ environment: string; total: number; passed: number; failed: number }>

    const analytics = {
      totalExecutions: totalExecutions.count,
      passRate: totalExecutions.count > 0 ? (passedExecutions.count / totalExecutions.count) * 100 : 0,
      avgDuration: avgDuration.avg_duration || 0,
      trendsData,
      typeDistribution: processedTypeDistribution,
      environmentStats,
    }

    return NextResponse.json({
      analytics,
    })
  } catch (error) {
    console.error("Analytics fetch error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
