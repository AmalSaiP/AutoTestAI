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

    const executions = db
      .prepare(`
      SELECT 
        te.*,
        tc.name as test_name
      FROM test_executions te
      JOIN test_cases tc ON te.test_case_id = tc.id
      WHERE tc.created_by = ?
      ORDER BY te.created_at DESC
    `)
      .all(decoded.id)

    return NextResponse.json({
      executions,
    })
  } catch (error) {
    console.error("Executions fetch error:", error)
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

    const { testCaseIds, environment } = await request.json()

    if (!testCaseIds || testCaseIds.length === 0) {
      return NextResponse.json({ error: "Test case IDs are required" }, { status: 400 })
    }

    const db = getDatabase()
    const insertStmt = db.prepare(`
      INSERT INTO test_executions (id, test_case_id, status, duration, environment, triggered_by, logs)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)

    const executions = []

    for (const testCaseId of testCaseIds) {
      const id = generateId()

      // Simulate test execution
      const duration = Math.floor(Math.random() * 5000) + 1000 // 1-6 seconds
      const status = Math.random() > 0.2 ? "passed" : "failed" // 80% pass rate
      const logs =
        status === "passed"
          ? "Test executed successfully\nAll assertions passed\nExecution completed"
          : "Test failed\nAssertion error: Expected value did not match\nExecution failed"

      insertStmt.run(id, testCaseId, status, duration, environment, decoded.id, logs)

      executions.push({
        id,
        test_case_id: testCaseId,
        status,
        duration,
        environment,
        logs,
      })
    }

    return NextResponse.json({
      executions,
      message: "Tests executed successfully",
    })
  } catch (error) {
    console.error("Test execution error:", error)
    return NextResponse.json({ error: "Failed to execute tests" }, { status: 500 })
  }
}
