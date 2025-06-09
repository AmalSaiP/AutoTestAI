// Simple test file to verify AI service functionality
import { generateTestCases } from "./ai-service"

export async function testAIService() {
  try {
    console.log("Testing AI service...")

    const testRequest = {
      inputType: "user_story" as const,
      inputData: "As a user, I want to login to the system so that I can access my dashboard",
      testTypes: ["unit"] as const,
      language: "java" as const,
      additionalContext: "Simple login functionality test",
      framework: "Spring Boot",
      testingLibrary: "JUnit 5",
      aiModel: "gemini-1.5-pro",
    }

    const result = await generateTestCases(testRequest)
    console.log("AI service test successful:", result.length, "tests generated")
    return result
  } catch (error) {
    console.error("AI service test failed:", error)
    throw error
  }
}
