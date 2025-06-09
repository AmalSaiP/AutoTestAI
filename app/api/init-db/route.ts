import { NextResponse } from "next/server"
import { initializeDatabase } from "@/lib/database"

export async function POST() {
  try {
    initializeDatabase()
    return NextResponse.json({ message: "Database initialized successfully" })
  } catch (error) {
    console.error("Database initialization error:", error)
    return NextResponse.json({ error: "Failed to initialize database" }, { status: 500 })
  }
}
