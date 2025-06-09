import { generateText } from "ai"
import { google } from "@ai-sdk/google"

export interface TestGenerationRequest {
  inputType: "user_story" | "code" | "api_spec" | "git_repo" | "postman_collection" | "web_url"
  inputData: string
  testTypes: ("bdd" | "unit" | "api" | "ui" | "performance")[]
  language: "java" | "python" | "javascript"
  additionalContext?: string
  framework?: string
  testingLibrary?: string
  projectStructure?: any
  aiModel?: string
}

export interface GeneratedTest {
  type: string
  content: string
  filename: string
  description: string
  coverage: string[]
  dependencies: string[]
  category?: "main" | "step_definitions" | "utils" | "runner" | "page_objects" | "config"
}

export interface ProjectAnalysis {
  structure: any
  dependencies: string[]
  frameworks: string[]
  testableClasses: any[]
  apiEndpoints: any[]
  complexity: "low" | "medium" | "high"
}

// Get AI model using Google AI Studio with fallback to smaller models
function getAIModel(modelName?: string) {
  const googleApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
  if (!googleApiKey) {
    throw new Error(
      "Google AI Studio API key not found. Please set GOOGLE_GENERATIVE_AI_API_KEY in your environment variables.",
    )
  }

  // Use smaller, more efficient model for free tier
  const model = modelName || "gemini-1.5-flash"

  return google(model, {
    apiKey: googleApiKey,
  })
}

// Enhanced AI service with quota management and fallbacks
export async function generateTestCases(request: TestGenerationRequest): Promise<GeneratedTest[]> {
  const tests: GeneratedTest[] = []

  try {
    // For quota management, we'll generate tests more efficiently
    let analysis: any = {}
    let useAI = true

    try {
      const model = getAIModel(request.aiModel)

      // Try AI analysis first, but with shorter prompts to save tokens
      switch (request.inputType) {
        case "git_repo":
          analysis = await analyzeGitRepository(request.inputData, model)
          break
        case "postman_collection":
          analysis = await analyzePostmanCollection(request.inputData, model)
          break
        case "web_url":
          analysis = await analyzeWebPage(request.inputData, model)
          break
        case "code":
          // Check if input contains file upload data
          if (request.inputData.includes("// File:")) {
            // Parse uploaded files from input data
            const fileContents = parseUploadedFiles(request.inputData)
            analysis = await analyzeUploadedFiles(fileContents, model)
          } else {
            analysis = await analyzeInput(request, model)
          }
          break
        default:
          analysis = await analyzeInput(request, model)
      }
    } catch (error: any) {
      console.warn("AI analysis failed, using fallback templates:", error.message)
      useAI = false
      // Use fallback analysis when quota exceeded
      analysis = getFallbackAnalysis(request)
    }

    // Generate tests with fallback mechanisms
    for (const testType of request.testTypes) {
      try {
        let generatedTests: GeneratedTest[] = []

        if (useAI) {
          try {
            const model = getAIModel(request.aiModel)
            generatedTests = await generateSpecificTestType(request, testType, analysis, model)
          } catch (error: any) {
            if (error.message.includes("quota") || error.message.includes("429")) {
              console.warn(`Quota exceeded for ${testType}, using template fallback`)
              generatedTests = await generateTestFromTemplate(request, testType, analysis)
            } else {
              throw error
            }
          }
        } else {
          // Use template-based generation when AI is unavailable
          generatedTests = await generateTestFromTemplate(request, testType, analysis)
        }

        tests.push(...generatedTests)
      } catch (error) {
        console.error(`Error generating ${testType} test:`, error)
        // Generate a basic template as last resort
        const fallbackTest = generateBasicTestTemplate(request, testType)
        if (fallbackTest) {
          tests.push(fallbackTest)
        }
      }
    }

    if (tests.length === 0) {
      // Generate at least one basic test as absolute fallback
      const basicTest = generateBasicTestTemplate(request, request.testTypes[0])
      if (basicTest) {
        tests.push(basicTest)
      } else {
        throw new Error("Unable to generate any tests. Please try again later or check your quota limits.")
      }
    }

    return tests
  } catch (error) {
    console.error(`Error with test generation:`, error)
    throw error
  }
}

// Analyze input for general cases
async function analyzeInput(request: TestGenerationRequest, model: any): Promise<any> {
  const shortPrompt = `Analyze this ${request.inputType}: ${request.inputData.substring(0, 500)}...
  
  Provide brief analysis in JSON format:
  {
    "complexity": "low|medium|high",
    "testableComponents": ["component1", "component2"],
    "riskAreas": ["area1", "area2"]
  }`

  try {
    const { text } = await generateText({
      model,
      prompt: shortPrompt,
      system:
        "You are a test analysis expert. Provide concise analysis. Return ONLY valid JSON without markdown formatting.",
      temperature: 0.1,
      maxTokens: 500,
    })

    const cleanedText = extractJsonFromResponse(text)
    return JSON.parse(cleanedText)
  } catch (error) {
    console.error("Error in analyzeInput:", error)
    return getFallbackAnalysis(request)
  }
}

// Enhanced analysis for uploaded files
async function analyzeUploadedFiles(files: any[], model: any): Promise<ProjectAnalysis> {
  // Prepare a concise summary of the uploaded files for AI analysis
  const fileSummary = files.slice(0, 10).map((file) => ({
    name: file.name,
    type: file.analysis.language,
    elements: file.analysis.testableElements.slice(0, 5), // Limit to prevent token overflow
    complexity: file.analysis.complexity,
    linesOfCode: file.analysis.linesOfCode,
  }))

  const analysisPrompt = `Analyze this uploaded project with ${files.length} files:

Files Summary: ${JSON.stringify(fileSummary, null, 2)}

Provide comprehensive analysis in JSON format:
{
  "structure": {
    "projectType": "maven|gradle|npm|django|rails",
    "mainLanguage": "java|python|javascript",
    "architecture": "mvc|microservices|monolith"
  },
  "testableClasses": [
    {
      "className": "UserService",
      "package": "com.example.service", 
      "methods": ["createUser", "findUser"],
      "complexity": "medium",
      "priority": "high"
    }
  ],
  "testingStrategy": {
    "unitTests": 15,
    "integrationTests": 5,
    "e2eTests": 3
  },
  "complexity": "medium"
}`

  try {
    const { text } = await generateText({
      model,
      prompt: analysisPrompt,
      system:
        "You are an expert software architect specializing in test strategy for large codebases. Return ONLY valid JSON without markdown formatting.",
      temperature: 0.1,
      maxTokens: 1000,
    })

    const cleanedText = extractJsonFromResponse(text)
    const analysis = JSON.parse(cleanedText)

    // Enhance with actual file data
    return {
      structure: analysis.structure || {},
      dependencies: extractDependencies(files),
      frameworks: detectFrameworks(files),
      testableClasses: analysis.testableClasses || [],
      apiEndpoints: extractApiEndpoints(files),
      complexity: analysis.complexity || "medium",
    }
  } catch (error) {
    console.error("Error in analyzeUploadedFiles:", error)
    return generateFallbackProjectAnalysis(files)
  }
}

function extractDependencies(files: any[]): string[] {
  const dependencies = new Set<string>()

  files.forEach((file) => {
    const content = file.content || ""

    // Java dependencies
    if (file.name.endsWith(".java")) {
      const imports = content.match(/import\s+([^;]+);/g) || []
      imports.forEach((imp) => {
        const dep = imp.replace("import ", "").replace(";", "").split(".")[0]
        if (!dep.startsWith("java.")) {
          dependencies.add(dep)
        }
      })
    }

    // Python dependencies
    if (file.name.endsWith(".py")) {
      const imports = content.match(/(?:from\s+(\w+)|import\s+(\w+))/g) || []
      imports.forEach((imp) => {
        const dep = imp.replace(/(?:from\s+|import\s+)/, "").split(".")[0]
        dependencies.add(dep)
      })
    }

    // JavaScript/TypeScript dependencies
    if (file.name.match(/\.(js|ts|jsx|tsx)$/)) {
      const imports = content.match(/(?:import.*from\s+['"]([^'"]+)['"]|require$$['"]([^'"]+)['"]$$)/g) || []
      imports.forEach((imp) => {
        const match = imp.match(/['"]([^'"]+)['"]/)
        if (match && !match[1].startsWith(".")) {
          dependencies.add(match[1].split("/")[0])
        }
      })
    }
  })

  return Array.from(dependencies).slice(0, 20) // Limit to prevent overflow
}

function detectFrameworks(files: any[]): string[] {
  const frameworks = new Set<string>()

  files.forEach((file) => {
    const content = file.content || ""
    const fileName = file.name.toLowerCase()

    // Java frameworks
    if (content.includes("@SpringBootApplication") || content.includes("org.springframework")) {
      frameworks.add("Spring Boot")
    }
    if (content.includes("@Entity") || content.includes("javax.persistence")) {
      frameworks.add("JPA/Hibernate")
    }
    if (content.includes("@RestController") || content.includes("@RequestMapping")) {
      frameworks.add("Spring MVC")
    }

    // Python frameworks
    if (content.includes("from django") || content.includes("import django")) {
      frameworks.add("Django")
    }
    if (content.includes("from flask") || content.includes("import flask")) {
      frameworks.add("Flask")
    }
    if (content.includes("from fastapi") || content.includes("import fastapi")) {
      frameworks.add("FastAPI")
    }

    // JavaScript frameworks
    if (content.includes("import React") || content.includes('from "react"')) {
      frameworks.add("React")
    }
    if (content.includes("import Vue") || content.includes('from "vue"')) {
      frameworks.add("Vue.js")
    }
    if (content.includes("import express") || content.includes('from "express"')) {
      frameworks.add("Express.js")
    }

    // Build tools
    if (fileName === "pom.xml") {
      frameworks.add("Maven")
    }
    if (fileName === "build.gradle") {
      frameworks.add("Gradle")
    }
    if (fileName === "package.json") {
      frameworks.add("npm/Node.js")
    }
  })

  return Array.from(frameworks)
}

function extractApiEndpoints(files: any[]): any[] {
  const endpoints: any[] = []

  files.forEach((file) => {
    const content = file.content || ""

    // Java Spring endpoints
    if (content.includes("@RequestMapping") || content.includes("@GetMapping")) {
      const mappings = content.match(/@(?:Request|Get|Post|Put|Delete)Mapping$$[^)]+$$/g) || []
      mappings.forEach((mapping) => {
        const pathMatch = mapping.match(/["']([^"']+)["']/)
        if (pathMatch) {
          endpoints.push({
            path: pathMatch[1],
            method: mapping.includes("Post")
              ? "POST"
              : mapping.includes("Put")
                ? "PUT"
                : mapping.includes("Delete")
                  ? "DELETE"
                  : "GET",
            file: file.name,
          })
        }
      })
    }

    // Express.js endpoints
    if (content.includes("app.get") || content.includes("router.")) {
      const routes = content.match(/(?:app|router)\.(get|post|put|delete)\(['"]([^'"]+)['"]/g) || []
      routes.forEach((route) => {
        const match = route.match(/\.(get|post|put|delete)\(['"]([^'"]+)['"]/)
        if (match) {
          endpoints.push({
            path: match[2],
            method: match[1].toUpperCase(),
            file: file.name,
          })
        }
      })
    }
  })

  return endpoints.slice(0, 20) // Limit to prevent overflow
}

function generateFallbackProjectAnalysis(files: any[]): ProjectAnalysis {
  const languages = files.reduce(
    (acc, file) => {
      const lang = file.analysis.language
      acc[lang] = (acc[lang] || 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )

  const mainLanguage = Object.entries(languages).sort(([, a], [, b]) => b - a)[0]?.[0] || "java"

  return {
    structure: {
      projectType: mainLanguage === "java" ? "maven" : mainLanguage === "python" ? "pip" : "npm",
      mainLanguage,
      totalFiles: files.length,
    },
    dependencies: ["junit", "mockito", "assertj"], // Default testing dependencies
    frameworks: [mainLanguage === "java" ? "Spring Boot" : mainLanguage === "python" ? "Django" : "Express.js"],
    testableClasses: files
      .flatMap((file) =>
        file.analysis.testableElements.map((element: string) => ({
          className: element,
          package: file.name.replace(/\.[^.]+$/, ""),
          methods: ["testMethod"],
          complexity: file.analysis.complexity,
        })),
      )
      .slice(0, 20),
    apiEndpoints: [],
    complexity: files.length > 20 ? "high" : files.length > 10 ? "medium" : "low",
  }
}

function parseUploadedFiles(inputData: string): any[] {
  const files = []
  const fileBlocks = inputData.split("// File:").slice(1) // Remove first empty element

  fileBlocks.forEach((block) => {
    const lines = block.trim().split("\n")
    const fileName = lines[0].trim()
    const content = lines.slice(1).join("\n")

    files.push({
      name: fileName,
      content: content,
      analysis: {
        language: getLanguageFromExtension(fileName),
        linesOfCode: content.split("\n").filter((line) => line.trim()).length,
        testableElements: fileName.endsWith(".java")
          ? extractJavaElements(content)
          : fileName.endsWith(".py")
            ? extractPythonElements(content)
            : extractJavaScriptElements(content),
        complexity: "medium",
      },
    })
  })

  return files
}

// Analyze Git Repository for comprehensive unit testing
async function analyzeGitRepository(repoUrl: string, model: any): Promise<ProjectAnalysis> {
  const analysisPrompt = `Analyze this Git repository URL: ${repoUrl}

Provide analysis in JSON format:
{
  "structure": {"projectType": "maven", "mainPackages": ["com.example"]},
  "dependencies": ["spring-boot", "junit"],
  "frameworks": ["Spring Boot"],
  "testableClasses": [{"className": "UserService", "package": "com.example", "methods": ["createUser"]}],
  "apiEndpoints": [{"path": "/api/users", "method": "POST"}],
  "complexity": "medium"
}`

  try {
    const { text } = await generateText({
      model,
      prompt: analysisPrompt,
      system:
        "You are a software architect. Provide concise project analysis. Return ONLY valid JSON without markdown formatting.",
      temperature: 0.1,
      maxTokens: 800,
    })

    const cleanedText = extractJsonFromResponse(text)
    return JSON.parse(cleanedText)
  } catch (error) {
    console.error("Error in analyzeGitRepository:", error)
    return inferProjectStructure(repoUrl)
  }
}

// Analyze Postman Collection
async function analyzePostmanCollection(collectionData: string, model: any): Promise<any> {
  let parsedCollection: any = {}

  try {
    parsedCollection = JSON.parse(collectionData.substring(0, 1000))
  } catch {
    parsedCollection = { raw: collectionData.substring(0, 1000) }
  }

  const analysisPrompt = `Analyze this Postman collection: ${JSON.stringify(parsedCollection)}

Provide analysis in JSON format:
{
  "endpoints": [{"name": "Create User", "method": "POST", "url": "/api/users"}],
  "workflows": [{"name": "User CRUD", "steps": ["Create", "Read"]}]
}`

  try {
    const { text } = await generateText({
      model,
      prompt: analysisPrompt,
      system:
        "You are an API testing expert. Provide concise analysis. Return ONLY valid JSON without markdown formatting.",
      temperature: 0.1,
      maxTokens: 600,
    })

    const cleanedText = extractJsonFromResponse(text)
    return JSON.parse(cleanedText)
  } catch (error) {
    console.error("Error in analyzePostmanCollection:", error)
    return { endpoints: [], workflows: [] }
  }
}

// Analyze Web Page
async function analyzeWebPage(webUrl: string, model: any): Promise<any> {
  const analysisPrompt = `Analyze this web page URL: ${webUrl}

Provide analysis in JSON format:
{
  "pageType": "login",
  "elements": [{"type": "input", "id": "email", "selector": "#email"}],
  "workflows": [{"name": "Login", "steps": ["Enter email", "Submit"]}]
}`

  try {
    const { text } = await generateText({
      model,
      prompt: analysisPrompt,
      system:
        "You are a UI testing expert. Provide concise analysis. Return ONLY valid JSON without markdown formatting.",
      temperature: 0.1,
      maxTokens: 500,
    })

    // Clean the response to extract JSON
    const cleanedText = extractJsonFromResponse(text)
    return JSON.parse(cleanedText)
  } catch (error) {
    console.error("Error in analyzeWebPage:", error)
    return inferPageStructure(webUrl)
  }
}

// Helper function to extract JSON from AI responses
function extractJsonFromResponse(text: string): string {
  // Remove markdown code blocks
  let cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "")

  // Find JSON object boundaries
  const jsonStart = cleaned.indexOf("{")
  const jsonEnd = cleaned.lastIndexOf("}")

  if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
    cleaned = cleaned.substring(jsonStart, jsonEnd + 1)
  }

  // Remove any trailing text after the JSON
  const lines = cleaned.split("\n")
  const jsonLines = []
  let braceCount = 0
  let foundStart = false

  for (const line of lines) {
    if (line.includes("{")) {
      foundStart = true
    }

    if (foundStart) {
      jsonLines.push(line)
      braceCount += (line.match(/\{/g) || []).length
      braceCount -= (line.match(/\}/g) || []).length

      if (braceCount === 0 && foundStart) {
        break
      }
    }
  }

  return jsonLines.join("\n").trim()
}

// Generate specific test types
async function generateSpecificTestType(
  request: TestGenerationRequest,
  testType: string,
  analysis: any,
  model: any,
): Promise<GeneratedTest[]> {
  const tests: GeneratedTest[] = []

  switch (testType) {
    case "unit":
      // Check if this is a project-level analysis with multiple classes
      if (analysis.testableClasses && analysis.testableClasses.length > 1) {
        tests.push(...(await generateProjectLevelUnitTests(request, analysis, model)))
      } else {
        tests.push(await generateSingleUnitTest(request, analysis, model))
      }
      break
    case "bdd":
      tests.push(await generateSingleBDDTest(request, analysis, model))
      break
    case "api":
      tests.push(await generateSingleAPITest(request, analysis, model))
      break
    case "ui":
      tests.push(await generateSingleUITest(request, analysis, model))
      break
    case "performance":
      tests.push(await generateSinglePerformanceTest(request, analysis, model))
      break
  }

  return tests
}

// Generate comprehensive unit tests for entire project
async function generateProjectLevelUnitTests(
  request: TestGenerationRequest,
  analysis: ProjectAnalysis,
  model: any,
): Promise<GeneratedTest[]> {
  const tests: GeneratedTest[] = []

  // Generate tests for each testable class
  for (const testableClass of analysis.testableClasses.slice(0, 10)) {
    // Limit to prevent quota issues
    try {
      const classPrompt = `Generate comprehensive ${request.language} unit tests for this class:

Class: ${testableClass.className}
Package: ${testableClass.package || "com.example"}
Methods: ${testableClass.methods?.join(", ") || "standard methods"}
Dependencies: ${testableClass.dependencies?.join(", ") || "none"}
Complexity: ${testableClass.complexity || "medium"}

Project Context:
- Framework: ${analysis.frameworks?.join(", ") || "Standard"}
- Dependencies: ${analysis.dependencies?.join(", ") || "Standard"}
- Architecture: ${analysis.structure?.architecture || "Standard"}

Requirements:
1. Use ${getTestingFramework(request.language)}
2. Mock all external dependencies
3. Test all public methods with positive, negative, and edge cases
4. Include proper setup and teardown
5. Use descriptive test names
6. Follow ${request.language} best practices
7. Include exception testing
8. Add parameterized tests where appropriate

Generate complete, production-ready test class.`

      const { text } = await generateText({
        model,
        prompt: classPrompt,
        system: getSystemPrompt("unit", request.language),
        temperature: 0.2,
        maxTokens: 2000,
      })

      tests.push({
        type: "unit",
        content: text,
        filename: `${testableClass.className}Test.${getFileExtension(request.language)}`,
        description: `Comprehensive unit tests for ${testableClass.className}`,
        coverage: [
          `All methods of ${testableClass.className}`,
          "Edge cases and error scenarios",
          "Dependency mocking",
          "Exception handling",
        ],
        dependencies: getDefaultDependencies("unit", request.language),
        category: "main",
      })

      // Add a small delay to prevent rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100))
    } catch (error) {
      console.error(`Error generating unit test for ${testableClass.className}:`, error)

      // Generate a fallback template for this class
      const fallbackTest = generateClassSpecificTemplate(request, testableClass)
      if (fallbackTest) {
        tests.push(fallbackTest)
      }
    }
  }

  // Generate a test suite runner if multiple tests were created
  if (tests.length > 1) {
    const suiteTest = generateTestSuiteRunner(request, tests, analysis)
    if (suiteTest) {
      tests.push(suiteTest)
    }
  }

  return tests
}

// Generate class-specific template when AI fails
function generateClassSpecificTemplate(request: TestGenerationRequest, testableClass: any): GeneratedTest | null {
  const className = testableClass.className || "TestClass"
  const methods = testableClass.methods || ["testMethod"]

  let content = ""

  if (request.language === "java") {
    content = `package ${testableClass.package || "com.example"}.test;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.InjectMocks;
import org.mockito.junit.jupiter.MockitoExtension;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("${className} Unit Tests")
public class ${className}Test {
    
    @Mock
    private Object mockDependency;
    
    @InjectMocks
    private ${className} ${className.toLowerCase()};
    
    @BeforeEach
    void setUp() {
        // Setup test data and mocks
    }
    
${methods
  .map(
    (method) => `    @Test
    @DisplayName("Should test ${method} functionality")
    void test${method.charAt(0).toUpperCase() + method.slice(1)}() {
        // Arrange
        // Set up test data and mock behavior
        
        // Act
        // Call the method under test
        
        // Assert
        // Verify the results and mock interactions
        assertNotNull(${className.toLowerCase()});
    }
    
    @Test
    @DisplayName("Should handle ${method} edge cases")
    void test${method.charAt(0).toUpperCase() + method.slice(1)}EdgeCases() {
        // Test edge cases and error scenarios
        assertThrows(Exception.class, () -> {
            // Test exception scenarios
        });
    }`,
  )
  .join("\n\n")}
}`
  } else if (request.language === "python") {
    content = `import unittest
from unittest.mock import Mock, patch, MagicMock
import pytest

class Test${className}(unittest.TestCase):
    
    def setUp(self):
        """Set up test fixtures before each test method."""
        self.mock_dependency = Mock()
        self.${className.toLowerCase()} = ${className}(self.mock_dependency)
    
${methods
  .map(
    (method) => `    def test_${method}(self):
        """Test ${method} functionality."""
        # Arrange
        expected_result = "test_result"
        
        # Act
        result = self.${className.toLowerCase()}.${method}()
        
        # Assert
        self.assertIsNotNone(result)
        
    def test_${method}_edge_cases(self):
        """Test ${method} edge cases and error scenarios."""
        with self.assertRaises(Exception):
            self.${className.toLowerCase()}.${method}(None)`,
  )
  .join("\n\n")}

if __name__ == '__main__':
    unittest.main()`
  } else {
    content = `const { describe, it, expect, beforeEach, jest } = require('@jest/globals');

describe('${className}', () => {
    let ${className.toLowerCase()};
    let mockDependency;
    
    beforeEach(() => {
        mockDependency = jest.fn();
        ${className.toLowerCase()} = new ${className}(mockDependency);
    });
    
${methods
  .map(
    (method) => `    describe('${method}', () => {
        it('should test ${method} functionality', () => {
            // Arrange
            const expectedResult = 'test_result';
            
            // Act
            const result = ${className.toLowerCase()}.${method}();
            
            // Assert
            expect(result).toBeDefined();
        });
        
        it('should handle ${method} edge cases', () => {
            // Test edge cases and error scenarios
            expect(() => {
                ${className.toLowerCase()}.${method}(null);
            }).toThrow();
        });
    });`,
  )
  .join("\n\n")}
});`
  }

  return {
    type: "unit",
    content,
    filename: `${className}Test.${getFileExtension(request.language)}`,
    description: `Template-based unit tests for ${className}`,
    coverage: [`${className} methods`, "Basic functionality", "Error handling"],
    dependencies: getDefaultDependencies("unit", request.language),
    category: "main",
  }
}

// Generate test suite runner
function generateTestSuiteRunner(
  request: TestGenerationRequest,
  tests: GeneratedTest[],
  analysis: ProjectAnalysis,
): GeneratedTest | null {
  let content = ""

  if (request.language === "java") {
    content = `package com.example.test;

import org.junit.platform.suite.api.SelectClasses;
import org.junit.platform.suite.api.Suite;
import org.junit.platform.suite.api.SuiteDisplayName;

@Suite
@SuiteDisplayName("Complete Unit Test Suite")
@SelectClasses({
${tests.map((test) => `    ${test.filename.replace(".java", "")}.class`).join(",\n")}
})
public class UnitTestSuite {
    // This class runs all unit tests in the project
    // Execute with: mvn test -Dtest=UnitTestSuite
}`
  } else if (request.language === "python") {
    content = `"""
Complete Unit Test Suite
Run with: python -m pytest test_suite.py -v
"""

import unittest
import sys
import os

# Import all test classes
${tests.map((test) => `from ${test.filename.replace(".py", "")} import ${test.filename.replace(".py", "").replace("test_", "Test")}`).join("\n")}

def create_test_suite():
    """Create a test suite containing all unit tests."""
    suite = unittest.TestSuite()
    
    # Add all test classes
${tests.map((test) => `    suite.addTest(unittest.makeSuite(${test.filename.replace(".py", "").replace("test_", "Test")}))`).join("\n")}
    
    return suite

if __name__ == '__main__':
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(create_test_suite())
    
    # Exit with error code if tests failed
    sys.exit(0 if result.wasSuccessful() else 1)`
  } else {
    content = `/**
 * Complete Unit Test Suite
 * Run with: npm test
 */

// Import all test files
${tests.map((test) => `require('./${test.filename}');`).join("\n")}

// Jest will automatically discover and run all tests
// Configuration in package.json:
/*
{
  "scripts": {
    "test": "jest",
    "test:coverage": "jest --coverage",
    "test:watch": "jest --watch"
  },
  "jest": {
    "testEnvironment": "node",
    "collectCoverageFrom": [
      "src/**/*.{js,jsx}",
      "!src/index.js"
    ]
  }
}
*/`
  }

  return {
    type: "unit",
    content,
    filename: `TestSuite.${getFileExtension(request.language)}`,
    description: "Complete unit test suite runner",
    coverage: ["All project classes", "Test execution", "Coverage reporting"],
    dependencies: [...getDefaultDependencies("unit", request.language), "test-runner"],
    category: "runner",
  }
}

// Get file extension for language
function getFileExtension(language: string): string {
  const extensions = {
    java: "java",
    python: "py",
    javascript: "js",
  }
  return extensions[language as keyof typeof extensions] || "txt"
}

// Generate single unit test
async function generateSingleUnitTest(
  request: TestGenerationRequest,
  analysis: any,
  model: any,
): Promise<GeneratedTest> {
  const prompt = `Generate a ${request.language} unit test for: ${request.inputData.substring(0, 800)}

Requirements:
- Use ${getTestingFramework(request.language)}
- Include setup, test methods, and assertions
- Test positive and negative cases
- Follow best practices

Generate complete test code.`

  const { text } = await generateText({
    model,
    prompt,
    system: getSystemPrompt("unit", request.language),
    temperature: 0.2,
    maxTokens: 1500,
  })

  return {
    type: "unit",
    content: text,
    filename: generateFilename("unit", request.language, request.inputData),
    description: `Unit test for ${request.inputType}`,
    coverage: ["Method functionality", "Edge cases", "Error handling"],
    dependencies: getDefaultDependencies("unit", request.language),
    category: "main",
  }
}

// Generate single BDD test
async function generateSingleBDDTest(
  request: TestGenerationRequest,
  analysis: any,
  model: any,
): Promise<GeneratedTest> {
  const prompt = `Generate a BDD feature file for: ${request.inputData.substring(0, 800)}

Requirements:
- Use Gherkin syntax (Given-When-Then)
- Include multiple scenarios
- Add examples for data-driven testing
- Cover positive and negative cases

Generate complete feature file.`

  const { text } = await generateText({
    model,
    prompt,
    system: getSystemPrompt("bdd", request.language),
    temperature: 0.2,
    maxTokens: 1200,
  })

  return {
    type: "bdd",
    content: text,
    filename: generateFilename("bdd", request.language, request.inputData),
    description: `BDD scenarios for ${request.inputType}`,
    coverage: ["User workflows", "Business rules", "Integration scenarios"],
    dependencies: getDefaultDependencies("bdd", request.language),
    category: "main",
  }
}

// Generate single API test
async function generateSingleAPITest(
  request: TestGenerationRequest,
  analysis: any,
  model: any,
): Promise<GeneratedTest> {
  const prompt = `Generate ${request.language} API tests for: ${request.inputData.substring(0, 800)}

Requirements:
- Test HTTP methods (GET, POST, PUT, DELETE)
- Validate status codes and response body
- Include authentication testing
- Test error scenarios

Generate complete API test code.`

  const { text } = await generateText({
    model,
    prompt,
    system: getSystemPrompt("api", request.language),
    temperature: 0.2,
    maxTokens: 1500,
  })

  return {
    type: "api",
    content: text,
    filename: generateFilename("api", request.language, request.inputData),
    description: `API tests for ${request.inputType}`,
    coverage: ["HTTP methods", "Status codes", "Data validation"],
    dependencies: getDefaultDependencies("api", request.language),
    category: "main",
  }
}

// Generate single UI test
async function generateSingleUITest(request: TestGenerationRequest, analysis: any, model: any): Promise<GeneratedTest> {
  const prompt = `Generate ${request.language} UI tests for: ${request.inputData.substring(0, 800)}

Requirements:
- Use Selenium WebDriver
- Implement Page Object Model
- Test user interactions and validations
- Include cross-browser support

Generate complete UI test code.`

  const { text } = await generateText({
    model,
    prompt,
    system: getSystemPrompt("ui", request.language),
    temperature: 0.2,
    maxTokens: 1500,
  })

  return {
    type: "ui",
    content: text,
    filename: generateFilename("ui", request.language, request.inputData),
    description: `UI tests for ${request.inputType}`,
    coverage: ["User interactions", "Form validation", "Navigation"],
    dependencies: getDefaultDependencies("ui", request.language),
    category: "main",
  }
}

// Generate single performance test
async function generateSinglePerformanceTest(
  request: TestGenerationRequest,
  analysis: any,
  model: any,
): Promise<GeneratedTest> {
  const prompt = `Generate performance tests for: ${request.inputData.substring(0, 800)}

Requirements:
- Create load testing scenarios
- Include response time monitoring
- Test concurrent users
- Generate performance reports

Generate complete performance test code.`

  const { text } = await generateText({
    model,
    prompt,
    system: getSystemPrompt("performance", request.language),
    temperature: 0.2,
    maxTokens: 1500,
  })

  return {
    type: "performance",
    content: text,
    filename: generateFilename("performance", request.language, request.inputData),
    description: `Performance tests for ${request.inputType}`,
    coverage: ["Load testing", "Stress testing", "Scalability"],
    dependencies: getDefaultDependencies("performance", request.language),
    category: "main",
  }
}

// Template-based generation when AI is unavailable
async function generateTestFromTemplate(
  request: TestGenerationRequest,
  testType: string,
  analysis: any,
): Promise<GeneratedTest[]> {
  const template = generateBasicTestTemplate(request, testType)
  return template ? [template] : []
}

// Generate basic test template as fallback
function generateBasicTestTemplate(request: TestGenerationRequest, testType: string): GeneratedTest | null {
  const templates = {
    unit: {
      java: `package com.example.test;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import static org.junit.jupiter.api.Assertions.*;

@DisplayName("Generated Unit Test")
public class GeneratedTest {
    
    @BeforeEach
    void setUp() {
        // Setup test data
    }
    
    @Test
    @DisplayName("Should test basic functionality")
    void testBasicFunctionality() {
        // Arrange
        String input = "test";
        
        // Act
        String result = processInput(input);
        
        // Assert
        assertNotNull(result);
        assertEquals("expected", result);
    }
    
    @Test
    @DisplayName("Should handle null input")
    void testNullInput() {
        // Test null handling
        assertThrows(IllegalArgumentException.class, () -> {
            processInput(null);
        });
    }
    
    private String processInput(String input) {
        if (input == null) {
            throw new IllegalArgumentException("Input cannot be null");
        }
        return "processed: " + input;
    }
}`,
      python: `import unittest
from unittest.mock import Mock, patch

class TestGenerated(unittest.TestCase):
    
    def setUp(self):
        """Set up test fixtures"""
        self.test_data = "test_input"
    
    def test_basic_functionality(self):
        """Test basic functionality"""
        # Arrange
        input_data = self.test_data
        
        # Act
        result = self.process_input(input_data)
        
        # Assert
        self.assertIsNotNone(result)
        self.assertEqual("processed: test_input", result)
    
    def test_none_input(self):
        """Test handling of None input"""
        with self.assertRaises(ValueError):
            self.process_input(None)
    
    def process_input(self, input_data):
        """Process input data"""
        if input_data is None:
            raise ValueError("Input cannot be None")
        return f"processed: {input_data}"

if __name__ == '__main__':
    unittest.main()`,
      javascript: `const { describe, it, expect, beforeEach } = require('@jest/globals');

describe('Generated Test Suite', () => {
    let testData;
    
    beforeEach(() => {
        testData = 'test_input';
    });
    
    it('should test basic functionality', () => {
        // Arrange
        const input = testData;
        
        // Act
        const result = processInput(input);
        
        // Assert
        expect(result).toBeDefined();
        expect(result).toBe('processed: test_input');
    });
    
    it('should handle null input', () => {
        // Test null handling
        expect(() => {
            processInput(null);
        }).toThrow('Input cannot be null');
    });
    
    function processInput(input) {
        if (input === null || input === undefined) {
            throw new Error('Input cannot be null');
        }
        return \`processed: \${input}\`;
    }
});`,
    },
    bdd: {
      feature: `Feature: Generated Feature
  As a user
  I want to test functionality
  So that I can ensure quality

  Background:
    Given the system is initialized
    And test data is prepared

  @smoke
  Scenario: Basic functionality test
    Given I have valid input data
    When I process the data
    Then I should get expected results
    And the system should remain stable

  @regression
  Scenario Outline: Data validation test
    Given I have input data "<input>"
    When I validate the data
    Then the result should be "<result>"
    
    Examples:
      | input    | result  |
      | valid    | success |
      | invalid  | error   |
      | empty    | error   |

  @error-handling
  Scenario: Error handling test
    Given I have invalid input
    When I process the data
    Then I should get an error message
    And the error should be logged`,
    },
    api: {
      java: `package com.example.api.test;

import io.restassured.RestAssured;
import io.restassured.response.Response;
import org.testng.annotations.BeforeClass;
import org.testng.annotations.Test;
import static io.restassured.RestAssured.*;
import static org.hamcrest.Matchers.*;

public class GeneratedAPITest {
    
    @BeforeClass
    public void setup() {
        RestAssured.baseURI = "http://localhost:8080";
        RestAssured.basePath = "/api";
    }
    
    @Test
    public void testGetEndpoint() {
        given()
            .header("Content-Type", "application/json")
        .when()
            .get("/users")
        .then()
            .statusCode(200)
            .body("size()", greaterThan(0));
    }
    
    @Test
    public void testPostEndpoint() {
        String requestBody = "{\\"name\\": \\"John\\", \\"email\\": \\"john@example.com\\"}";
        
        given()
            .header("Content-Type", "application/json")
            .body(requestBody)
        .when()
            .post("/users")
        .then()
            .statusCode(201)
            .body("name", equalTo("John"))
            .body("email", equalTo("john@example.com"));
    }
    
    @Test
    public void testErrorHandling() {
        given()
            .header("Content-Type", "application/json")
        .when()
            .get("/users/999999")
        .then()
            .statusCode(404)
            .body("error", notNullValue());
    }
}`,
    },
    ui: {
      java: `package com.example.ui.test;

import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.FindBy;
import org.openqa.selenium.support.PageFactory;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.testng.annotations.AfterMethod;
import org.testng.annotations.BeforeMethod;
import org.testng.annotations.Test;
import io.github.bonigarcia.wdm.WebDriverManager;
import org.openqa.selenium.chrome.ChromeDriver;
import static org.testng.Assert.*;

public class GeneratedUITest {
    
    private WebDriver driver;
    private WebDriverWait wait;
    
    @FindBy(id = "email")
    private WebElement emailField;
    
    @FindBy(id = "password")
    private WebElement passwordField;
    
    @FindBy(id = "submit")
    private WebElement submitButton;
    
    @BeforeMethod
    public void setup() {
        WebDriverManager.chromedriver().setup();
        driver = new ChromeDriver();
        wait = new WebDriverWait(driver, 10);
        PageFactory.initElements(driver, this);
    }
    
    @Test
    public void testLoginForm() {
        driver.get("http://localhost:3000/login");
        
        emailField.sendKeys("test@example.com");
        passwordField.sendKeys("password123");
        submitButton.click();
        
        // Verify successful login
        assertTrue(driver.getCurrentUrl().contains("dashboard"));
    }
    
    @Test
    public void testFormValidation() {
        driver.get("http://localhost:3000/login");
        
        submitButton.click();
        
        // Verify validation messages
        assertTrue(emailField.getAttribute("validationMessage").contains("required"));
    }
    
    @AfterMethod
    public void tearDown() {
        if (driver != null) {
            driver.quit();
        }
    }
}`,
    },
    performance: {
      jmx: `<?xml version="1.0" encoding="UTF-8"?>
<jmeterTestPlan version="1.2">
  <hashTree>
    <TestPlan guiclass="TestPlanGui" testclass="TestPlan" testname="Generated Performance Test">
      <stringProp name="TestPlan.comments">Generated performance test plan</stringProp>
      <boolProp name="TestPlan.functional_mode">false</boolProp>
      <boolProp name="TestPlan.serialize_threadgroups">false</boolProp>
      <elementProp name="TestPlan.arguments" elementType="Arguments" guiclass="ArgumentsPanel">
        <collectionProp name="Arguments.arguments"/>
      </elementProp>
      <stringProp name="TestPlan.user_define_classpath"></stringProp>
    </TestPlan>
    <hashTree>
      <ThreadGroup guiclass="ThreadGroupGui" testclass="ThreadGroup" testname="Load Test">
        <stringProp name="ThreadGroup.on_sample_error">continue</stringProp>
        <elementProp name="ThreadGroup.main_controller" elementType="LoopController">
          <boolProp name="LoopController.continue_forever">false</boolProp>
          <stringProp name="LoopController.loops">10</stringProp>
        </elementProp>
        <stringProp name="ThreadGroup.num_threads">50</stringProp>
        <stringProp name="ThreadGroup.ramp_time">60</stringProp>
        <longProp name="ThreadGroup.start_time">1</longProp>
        <longProp name="ThreadGroup.end_time">1</longProp>
        <boolProp name="ThreadGroup.scheduler">false</boolProp>
        <stringProp name="ThreadGroup.duration"></stringProp>
        <stringProp name="ThreadGroup.delay"></stringProp>
      </ThreadGroup>
      <hashTree>
        <HTTPSamplerProxy guiclass="HttpTestSampleGui" testclass="HTTPSamplerProxy" testname="API Request">
          <elementProp name="HTTPsampler.Arguments" elementType="Arguments">
            <collectionProp name="Arguments.arguments"/>
          </elementProp>
          <stringProp name="HTTPSampler.domain">localhost</stringProp>
          <stringProp name="HTTPSampler.port">8080</stringProp>
          <stringProp name="HTTPSampler.protocol">http</stringProp>
          <stringProp name="HTTPSampler.contentEncoding"></stringProp>
          <stringProp name="HTTPSampler.path">/api/users</stringProp>
          <stringProp name="HTTPSampler.method">GET</stringProp>
          <boolProp name="HTTPSampler.follow_redirects">true</boolProp>
          <boolProp name="HTTPSampler.auto_redirects">false</boolProp>
          <boolProp name="HTTPSampler.use_keepalive">true</boolProp>
        </HTTPSamplerProxy>
      </hashTree>
    </hashTree>
  </hashTree>
</jmeterTestPlan>`,
    },
  }

  const languageKey = request.language as keyof typeof templates.unit
  const testTemplate = templates[testType as keyof typeof templates]

  if (!testTemplate) return null

  let content = ""
  let filename = ""

  if (testType === "bdd") {
    content = testTemplate.feature
    filename = "generated-test.feature"
  } else if (testType === "performance") {
    content = testTemplate.jmx
    filename = "performance-test.jmx"
  } else {
    content = testTemplate[languageKey] || testTemplate.java || ""
    filename = generateFilename(testType, request.language, request.inputData)
  }

  if (!content) return null

  return {
    type: testType,
    content,
    filename,
    description: `Template-based ${testType} test for ${request.inputType}`,
    coverage: [`Basic ${testType} testing`, "Template-generated", "Fallback implementation"],
    dependencies: getDefaultDependencies(testType, request.language),
    category: "main",
  }
}

// Helper functions
function getFallbackAnalysis(request: TestGenerationRequest): any {
  return {
    complexity: "medium",
    estimatedExecutionTime: 30,
    riskAreas: ["Data validation", "Error handling"],
    recommendations: ["Add edge case testing", "Include negative scenarios"],
    testableComponents: ["main functionality", "error handling", "data validation"],
  }
}

function inferProjectStructure(repoUrl: string): ProjectAnalysis {
  return {
    structure: {
      projectType: "maven",
      mainPackages: ["com.example.service", "com.example.controller"],
      testPackages: ["com.example.service.test"],
      configFiles: ["pom.xml"],
      sourceDirectories: ["src/main/java", "src/test/java"],
    },
    dependencies: ["spring-boot-starter", "junit-jupiter", "mockito-core"],
    frameworks: ["Spring Boot", "JPA"],
    testableClasses: [
      {
        className: "UserService",
        package: "com.example.service",
        methods: ["createUser", "findUser", "updateUser", "deleteUser"],
        dependencies: ["UserRepository"],
      },
    ],
    apiEndpoints: [
      {
        path: "/api/users",
        method: "POST",
        controller: "UserController",
      },
    ],
    complexity: "medium",
  }
}

function inferPageStructure(webUrl: string): any {
  return {
    pageType: "login",
    elements: [
      {
        type: "input",
        id: "email",
        name: "email",
        selector: "#email",
        label: "Email Address",
        required: true,
        validation: "email format",
      },
      {
        type: "input",
        id: "password",
        name: "password",
        selector: "#password",
        label: "Password",
        required: true,
        validation: "minimum length",
      },
      {
        type: "button",
        id: "submit",
        selector: "#submit-btn",
        text: "Login",
        action: "submit form",
      },
    ],
    workflows: [
      {
        name: "User Login",
        steps: [
          "Navigate to login page",
          "Enter email",
          "Enter password",
          "Click login button",
          "Verify successful login",
        ],
      },
    ],
    validations: [
      "Email field validation",
      "Password field validation",
      "Error message display",
      "Successful login redirect",
    ],
  }
}

function getSystemPrompt(testType: string, language: string): string {
  const basePrompt = `You are an expert test automation engineer. Generate production-ready, comprehensive test code.`

  const typeSpecificPrompts = {
    bdd: `${basePrompt} For BDD tests: Use proper Gherkin syntax with Given-When-Then structure. Include multiple scenarios covering happy path, edge cases, and error conditions.`,
    unit: `${basePrompt} For Unit tests in ${language}: Use ${getTestingFramework(language)} framework. Include proper setup and teardown methods. Test all public methods and edge cases.`,
    api: `${basePrompt} For API tests in ${language}: Use ${getApiTestingLibrary(language)} for HTTP requests. Test all HTTP methods. Validate response status codes, headers, and body.`,
    ui: `${basePrompt} For UI tests in ${language}: Use Selenium WebDriver with Page Object Model pattern. Include explicit waits and proper element locators.`,
    performance: `${basePrompt} For Performance tests: Create JMeter test plans or ${language} performance scripts. Include ramp-up, steady state, and ramp-down phases.`,
  }

  return typeSpecificPrompts[testType as keyof typeof typeSpecificPrompts] || basePrompt
}

function getTestingFramework(language: string): string {
  const frameworks = {
    java: "JUnit 5 with Mockito",
    python: "pytest with unittest.mock",
    javascript: "Jest with testing-library",
  }

  return frameworks[language as keyof typeof frameworks] || "appropriate testing framework"
}

function getApiTestingLibrary(language: string): string {
  const libraries = {
    java: "RestAssured with TestNG",
    python: "requests with pytest",
    javascript: "axios with Jest",
  }

  return libraries[language as keyof typeof libraries] || "HTTP client library"
}

function generateFilename(testType: string, language: string, inputData: string): string {
  const extensions = {
    java: ".java",
    python: ".py",
    javascript: ".js",
  }

  const typePrefix = {
    bdd: "feature",
    unit: "test",
    api: "api-test",
    ui: "ui-test",
    performance: "perf-test",
  }

  // Extract a meaningful name from input data
  const baseName = extractBaseName(inputData, testType)

  if (testType === "bdd") {
    return `${baseName}.feature`
  }

  if (testType === "performance") {
    return `${baseName}.jmx`
  }

  const prefix = typePrefix[testType as keyof typeof typePrefix] || "test"
  const extension = extensions[language as keyof typeof extensions] || ".txt"

  return `${prefix}-${baseName}${extension}`
}

function extractBaseName(inputData: string, testType: string): string {
  // Extract meaningful name from input data
  const words = inputData
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2)
    .slice(0, 3)
    .join("-")

  return words || `${testType}-case`
}

function getDefaultDependencies(testType: string, language: string): string[] {
  const dependencyMap = {
    java: {
      unit: ["junit-jupiter", "mockito-core", "assertj-core"],
      bdd: ["cucumber-java", "cucumber-junit", "rest-assured"],
      api: ["rest-assured", "testng", "hamcrest"],
      ui: ["selenium-java", "webdrivermanager", "testng"],
      performance: ["apache-jmeter", "rest-assured", "micrometer-core"],
    },
    python: {
      unit: ["pytest", "unittest.mock", "pytest-mock"],
      bdd: ["behave", "requests", "pytest-bdd"],
      api: ["requests", "pytest", "jsonschema"],
      ui: ["selenium", "pytest", "webdriver-manager"],
      performance: ["locust", "requests", "pytest"],
    },
    javascript: {
      unit: ["jest", "@testing-library/react", "@testing-library/jest-dom"],
      bdd: ["cucumber", "axios", "chai"],
      api: ["axios", "jest", "supertest"],
      ui: ["selenium-webdriver", "jest", "webdriver-manager"],
      performance: ["artillery", "axios", "jest"],
    },
  }

  return dependencyMap[language as keyof typeof dependencyMap]?.[testType as keyof typeof dependencyMap.java] || []
}

// Enhanced test failure analysis with AI
export async function analyzeTestFailure(
  logs: string,
  testType: string,
  testCode?: string,
  aiModel?: string,
): Promise<string> {
  try {
    const model = getAIModel(aiModel)

    const { text } = await generateText({
      model,
      prompt: `Analyze this ${testType} test failure: ${logs.substring(0, 1000)}

Provide analysis:
1. Root cause
2. Fix suggestions
3. Prevention strategies`,
      system: `You are an expert test automation engineer and debugging specialist.`,
      temperature: 0.1,
      maxTokens: 800,
    })

    return text
  } catch (error) {
    console.error("Error analyzing test failure:", error)
    return `# Test Failure Analysis

## Error Summary
Unable to perform AI analysis of the test failure. Manual investigation required.

## Logs Analysis
${logs}

## Recommended Actions
1. Check test environment setup
2. Verify test data and dependencies
3. Review recent code changes
4. Check for timing issues or race conditions
5. Validate test assertions and expected outcomes`
  }
}

// Generate test data based on requirements
export async function generateTestData(testType: string, schema: any, aiModel?: string): Promise<any> {
  try {
    const model = getAIModel(aiModel)

    const { text } = await generateText({
      model,
      prompt: `Generate test data for ${testType} testing: ${JSON.stringify(schema).substring(0, 500)}

Return JSON with valid, invalid, and edge case data.`,
      system: "You are a test data generation expert.",
      temperature: 0.3,
      maxTokens: 600,
    })

    return JSON.parse(text)
  } catch (error) {
    console.error("Error generating test data:", error)
    return {
      valid: { message: "Default valid test data" },
      invalid: { message: "" },
      edge_cases: { message: "A".repeat(1000) },
    }
  }
}

// AI-powered test optimization suggestions
export async function optimizeTestSuite(testCodes: string[], metrics: any, aiModel?: string): Promise<string> {
  try {
    const model = getAIModel(aiModel)

    const { text } = await generateText({
      model,
      prompt: `Analyze test suite with ${testCodes.length} tests. Metrics: ${JSON.stringify(metrics).substring(0, 500)}

Provide optimization recommendations for:
1. Execution time
2. Maintenance
3. Reliability`,
      system: "You are a test automation architect.",
      temperature: 0.2,
      maxTokens: 800,
    })

    return text
  } catch (error) {
    console.error("Error optimizing test suite:", error)
    return "Unable to generate optimization recommendations. Please review test suite manually."
  }
}

function getLanguageFromExtension(filename: string): string {
  if (filename.endsWith(".java")) return "java"
  if (filename.endsWith(".py")) return "python"
  if (filename.endsWith(".js") || filename.endsWith(".jsx")) return "javascript"
  if (filename.endsWith(".ts") || filename.endsWith(".tsx")) return "typescript"
  return "unknown"
}

function extractJavaElements(content: string): string[] {
  const classMatch = content.match(/public\s+class\s+(\w+)/)
  const className = classMatch ? classMatch[1] : "UnknownClass"
  const methodMatches = content.match(/public\s+[^=]+\s+(\w+)\s*$$[^)]*$$\s*\{/g) || []
  const methods = methodMatches.map((match) => match.replace(/public\s+[^=]+\s+(\w+)\s*$$[^)]*$$\s*\{/, "$1"))
  return [`${className}`, ...methods]
}

function extractPythonElements(content: string): string[] {
  const classMatch = content.match(/class\s+(\w+)/)
  const className = classMatch ? classMatch[1] : "UnknownClass"
  const methodMatches = content.match(/def\s+(\w+)\s*$$[^)]*$$:/g) || []
  const methods = methodMatches.map((match) => match.replace(/def\s+(\w+)\s*$$[^)]*$$:/, "$1"))
  return [`${className}`, ...methods]
}

function extractJavaScriptElements(content: string): string[] {
  const classMatch = content.match(/class\s+(\w+)/)
  const className = classMatch ? classMatch[1] : "UnknownClass"
  const functionMatches = content.match(/function\s+(\w+)\s*$$[^)]*$$\s*\{/g) || []
  const functions = functionMatches.map((match) => match.replace(/function\s+(\w+)\s*$$[^)]*$$\s*\{/, "$1"))
  const methodMatches = content.match(/(\w+)\s*$$[^)]*$$\s*\{/g) || []
  const methods = methodMatches.map((match) => match.replace(/(\w+)\s*$$[^)]*$$\s*\{/, "$1"))
  return [`${className}`, ...functions, ...methods]
}
