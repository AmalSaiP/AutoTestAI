import { NextResponse } from "next/server"
import { testAIService } from "@/lib/test-ai-service"

export async function GET() {
  try {
    const result = await testAIService()
    return NextResponse.json({
      success: true,
      message: "AI service is working correctly",
      testsGenerated: result.length,
      sample: result[0]
        ? {
            type: result[0].type,
            filename: result[0].filename,
            description: result[0].description,
          }
        : null,
    })
  } catch (error) {
    console.error("AI service test error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        details: process.env.NODE_ENV === "development" ? error : undefined,
      },
      { status: 500 },
    )
  }
}
