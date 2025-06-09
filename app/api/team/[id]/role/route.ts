import { type NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/auth"
import { getDatabase } from "@/lib/database"

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
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

    const { role } = await request.json()

    if (!role || !["admin", "user", "viewer"].includes(role)) {
      return NextResponse.json({ error: "Valid role is required" }, { status: 400 })
    }

    const db = getDatabase()
    const memberId = params.id

    // Update role in team_members table
    const result = db
      .prepare("UPDATE team_members SET role = ? WHERE user_id = ? AND team_owner_id = ?")
      .run(role, memberId, decoded.id)

    if (result.changes === 0) {
      return NextResponse.json({ error: "Team member not found" }, { status: 404 })
    }

    // Also update the user's role in the users table
    db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, memberId)

    return NextResponse.json({
      message: "Role updated successfully",
    })
  } catch (error) {
    console.error("Role update error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
