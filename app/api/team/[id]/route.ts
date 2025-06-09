import { type NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/auth"
import { getDatabase } from "@/lib/database"

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
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
    const memberId = params.id

    // Remove from team_members table
    const result = db
      .prepare("DELETE FROM team_members WHERE user_id = ? AND team_owner_id = ?")
      .run(memberId, decoded.id)

    if (result.changes === 0) {
      return NextResponse.json({ error: "Team member not found" }, { status: 404 })
    }

    return NextResponse.json({
      message: "Team member removed successfully",
    })
  } catch (error) {
    console.error("Team member removal error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
