import { type NextRequest, NextResponse } from "next/server"
import { verifyToken, createUser } from "@/lib/auth"
import { getDatabase, generateId } from "@/lib/database"

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

    const { email, role, message } = await request.json()

    if (!email || !role) {
      return NextResponse.json({ error: "Email and role are required" }, { status: 400 })
    }

    const db = getDatabase()

    // Check if user already exists
    const existingUser = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as any

    let userId: string

    if (existingUser) {
      userId = existingUser.id

      // Check if already a team member
      const existingMember = db
        .prepare("SELECT * FROM team_members WHERE user_id = ? AND team_owner_id = ?")
        .get(userId, decoded.id)

      if (existingMember) {
        return NextResponse.json({ error: "User is already a team member" }, { status: 409 })
      }
    } else {
      // Create a new user with pending status
      const tempPassword = Math.random().toString(36).substring(2, 15)
      const newUser = await createUser(email, email.split("@")[0], tempPassword)
      userId = newUser.id
    }

    // Add to team_members table
    const memberStmt = db.prepare(`
      INSERT INTO team_members (id, user_id, team_owner_id, role, status)
      VALUES (?, ?, ?, ?, ?)
    `)

    const memberId = generateId()
    memberStmt.run(memberId, userId, decoded.id, role, existingUser ? "active" : "pending")

    // In a real app, you would send an email invitation here
    console.log(`Invitation sent to ${email} with role ${role}`)
    if (message) {
      console.log(`Personal message: ${message}`)
    }

    return NextResponse.json({
      message: "Invitation sent successfully",
      member: {
        id: memberId,
        email,
        role,
        status: existingUser ? "active" : "pending",
      },
    })
  } catch (error) {
    console.error("Team invitation error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
