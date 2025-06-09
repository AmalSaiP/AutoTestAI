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

    // Get projects with test counts and types
    const projects = db
      .prepare(`
      SELECT 
        p.*,
        COUNT(tc.id) as test_count,
        GROUP_CONCAT(DISTINCT tc.type) as test_types
      FROM projects p
      LEFT JOIN test_cases tc ON p.id = tc.project_id
      WHERE p.user_id = ?
      GROUP BY p.id
      ORDER BY p.updated_at DESC
    `)
      .all(decoded.id) as Array<{
      id: string
      name: string
      description: string
      created_at: string
      updated_at: string
      test_count: number
      test_types: string
    }>

    // Process test_types from comma-separated string to array
    const processedProjects = projects.map((project) => ({
      ...project,
      test_types: project.test_types ? project.test_types.split(",").filter(Boolean) : [],
    }))

    return NextResponse.json({
      projects: processedProjects,
    })
  } catch (error) {
    console.error("Projects fetch error:", error)
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

    const { name, description } = await request.json()

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Project name is required" }, { status: 400 })
    }

    const db = getDatabase()
    const id = generateId()

    const stmt = db.prepare(`
      INSERT INTO projects (id, name, description, user_id)
      VALUES (?, ?, ?, ?)
    `)

    stmt.run(id, name.trim(), description || "", decoded.id)

    const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(id)

    return NextResponse.json({
      project,
      message: "Project created successfully",
    })
  } catch (error) {
    console.error("Project creation error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
