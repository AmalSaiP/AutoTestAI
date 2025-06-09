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

    // Get test generation stats
    const testsResult = db.prepare("SELECT COUNT(*) as count FROM test_cases WHERE created_by = ?").get(decoded.id) as {
      count: number
    }

    // Get test execution stats
    const executionsResult = db
      .prepare(`
      SELECT COUNT(*) as count, 
             AVG(CASE WHEN status = 'passed' THEN 1 ELSE 0 END) * 100 as pass_rate
      FROM test_executions te
      JOIN test_cases tc ON te.test_case_id = tc.id
      WHERE tc.created_by = ?
    `)
      .get(decoded.id) as { count: number; pass_rate: number }

    // Get projects count
    const projectsResult = db.prepare("SELECT COUNT(*) as count FROM projects WHERE user_id = ?").get(decoded.id) as {
      count: number
    }

    // Get recent activity
    const activityResult = db
      .prepare(`
      SELECT 
        tc.id,
        tc.name,
        tc.type,
        tc.created_at
      FROM test_cases tc
      WHERE tc.created_by = ?
      ORDER BY tc.created_at DESC
      LIMIT 10
    `)
      .all(decoded.id) as Array<{ id: string; name: string; type: string; created_at: string }>

    const stats = {
      testsGenerated: testsResult.count,
      testsExecuted: executionsResult.count || 0,
      projectsCount: projectsResult.count,
      passRate: Math.round(executionsResult.pass_rate || 0),
      monthlyQuota: 500, // Based on plan
      quotaUsed: testsResult.count,
    }

    const recentActivity = activityResult.map((row) => ({
      id: row.id,
      type: row.type,
      description: `Generated ${row.type} test: ${row.name}`,
      timestamp: new Date(row.created_at).toLocaleString(),
      status: "success" as const,
    }))

    return NextResponse.json({
      stats,
      recentActivity,
    })
  } catch (error) {
    console.error("Dashboard stats error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
