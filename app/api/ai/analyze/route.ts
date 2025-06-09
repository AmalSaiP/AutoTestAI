import { type NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/auth"
import { analyzeTestFailure } from "@/lib/ai-service"

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

    const { logs, testType, testCode, aiModel } = await request.json()

    if (!logs || !testType) {
      return NextResponse.json({ error: "Logs and test type are required" }, { status: 400 })
    }

    // Analyze test failure using Google AI Studio
    const analysis = await analyzeTestFailure(logs, testType, testCode, aiModel || "gemini-1.5-pro")

    return NextResponse.json({
      analysis,
      message: "Test failure analyzed successfully",
    })
  } catch (error) {
    console.error("Test analysis error:", error)

    if (error instanceof Error) {
      if (error.message.includes("API key")) {
        return NextResponse.json(
          {
            error: "Google AI Studio API key not configured. Please contact support.",
          },
          { status: 500 },
        )
      }
    }

    return NextResponse.json(
      {
        error: "Failed to analyze test failure. Please try again or contact support if the issue persists.",
        details: process.env.NODE_ENV === "development" ? error : undefined,
      },
      { status: 500 },
    )
  }
}
