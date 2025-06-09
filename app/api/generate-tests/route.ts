import { type NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/auth"
import { generateTestCases } from "@/lib/ai-service"
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

    const {
      inputType,
      inputData,
      testTypes,
      language,
      additionalContext,
      framework,
      testingLibrary,
      projectId,
      aiModel,
    } = await request.json()

    if (!inputData || !testTypes || testTypes.length === 0) {
      return NextResponse.json({ error: "Input data and test types are required" }, { status: 400 })
    }

    // Validate input data length (reduced for quota management)
    if (inputData.length > 5000) {
      return NextResponse.json(
        { error: "Input data too large. Maximum 5,000 characters allowed to manage API quotas." },
        { status: 400 },
      )
    }

    // Check user's plan limits
    const db = getDatabase()
    const user = db.prepare("SELECT plan FROM users WHERE id = ?").get(decoded.id) as { plan: string }

    const planLimits = {
      free: 100, // Reduced limits due to quota constraints
      basic: 1000,
      pro: 5000,
      enterprise: 999999,
    }

    const userLimit = planLimits[user.plan as keyof typeof planLimits] || 100
    const currentUsage = db
      .prepare("SELECT COUNT(*) as count FROM test_cases WHERE created_by = ?")
      .get(decoded.id) as { count: number }

    if (currentUsage.count >= userLimit) {
      return NextResponse.json(
        {
          error: `Test generation limit reached. Upgrade your plan to generate more tests.`,
          limit: userLimit,
          current: currentUsage.count,
        },
        { status: 429 },
      )
    }

    // Generate tests with quota-aware service
    const generatedTests = await generateTestCases({
      inputType,
      inputData,
      testTypes,
      language,
      additionalContext,
      framework,
      testingLibrary,
      aiModel: "gemini-1.5-flash", // Force use of more efficient model
    })

    // Save to database with enhanced metadata
    const insertStmt = db.prepare(`
      INSERT INTO test_cases (id, project_id, name, type, content, input_source, ai_model_used, created_by, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const savedTests = []

    for (const test of generatedTests) {
      const id = generateId()
      const metadata = JSON.stringify({
        description: test.description,
        coverage: test.coverage,
        dependencies: test.dependencies,
        language,
        framework,
        testingLibrary,
        inputType,
        generatedAt: new Date().toISOString(),
        quotaOptimized: true, // Flag to indicate quota-optimized generation
      })

      insertStmt.run(
        id,
        projectId || null,
        test.filename,
        test.type,
        test.content,
        inputData.substring(0, 500), // Store first 500 chars only
        "gemini-1.5-flash",
        decoded.id,
        metadata,
      )

      savedTests.push({
        id,
        ...test,
      })
    }

    // Log generation activity
    const auditStmt = db.prepare(`
      INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?)
    `)

    auditStmt.run(
      decoded.id,
      "test_generation",
      "test_cases",
      savedTests.map((t) => t.id).join(","),
      request.headers.get("x-forwarded-for") || "unknown",
      request.headers.get("user-agent") || "unknown",
    )

    return NextResponse.json({
      tests: savedTests,
      message: "Tests generated successfully (quota-optimized)",
      usage: {
        current: currentUsage.count + generatedTests.length,
        limit: userLimit,
        remaining: userLimit - (currentUsage.count + generatedTests.length),
      },
      notice:
        "Using efficient generation to manage API quotas. For more advanced AI features, consider upgrading your Google AI Studio plan.",
    })
  } catch (error) {
    console.error("Test generation error:", error)

    // Enhanced error handling for quota issues
    if (error instanceof Error) {
      if (error.message.includes("quota") || error.message.includes("429")) {
        return NextResponse.json(
          {
            error: "Google AI Studio quota exceeded. Using template-based generation as fallback.",
            fallbackUsed: true,
            suggestion: "Try again in a few minutes or upgrade your Google AI Studio plan for higher quotas.",
          },
          { status: 429 },
        )
      }

      if (error.message.includes("rate limit")) {
        return NextResponse.json(
          {
            error: "AI service rate limit exceeded. Please try again in a few minutes.",
            retryAfter: 60,
          },
          { status: 429 },
        )
      }

      if (error.message.includes("API key")) {
        return NextResponse.json(
          {
            error: "Google AI Studio API key not configured or invalid. Please contact support.",
          },
          { status: 500 },
        )
      }
    }

    return NextResponse.json(
      {
        error: "Failed to generate tests. Using fallback templates.",
        details: process.env.NODE_ENV === "development" ? error : undefined,
        fallbackUsed: true,
      },
      { status: 500 },
    )
  }
}
