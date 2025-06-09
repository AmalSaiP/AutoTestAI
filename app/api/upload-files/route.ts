import { type NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/auth"

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

    const formData = await request.formData()
    const files = formData.getAll("files") as File[]

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 })
    }

    // Validate file types and sizes
    const validExtensions = [
      ".java",
      ".py",
      ".js",
      ".ts",
      ".jsx",
      ".tsx",
      ".cs",
      ".cpp",
      ".c",
      ".php",
      ".rb",
      ".go",
      ".kt",
      ".scala",
      ".swift",
    ]
    const maxFileSize = 10 * 1024 * 1024 // 10MB
    const maxTotalSize = 50 * 1024 * 1024 // 50MB total

    const validFiles = []
    let totalSize = 0

    for (const file of files) {
      const isValidType = validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext))
      const isValidSize = file.size <= maxFileSize

      if (!isValidType) {
        continue // Skip invalid file types
      }

      if (!isValidSize) {
        return NextResponse.json({ error: `File ${file.name} is too large. Maximum size is 10MB.` }, { status: 400 })
      }

      totalSize += file.size
      if (totalSize > maxTotalSize) {
        return NextResponse.json({ error: "Total upload size exceeds 50MB limit." }, { status: 400 })
      }

      validFiles.push(file)
    }

    // Process files and extract content
    const processedFiles = []

    for (const file of validFiles) {
      try {
        const content = await file.text()

        // Basic analysis of the file
        const analysis = analyzeSourceFile(file.name, content)

        processedFiles.push({
          name: file.name,
          size: file.size,
          type: getFileType(file.name),
          content: content,
          analysis: analysis,
          path: file.webkitRelativePath || file.name,
        })
      } catch (error) {
        console.error(`Error processing file ${file.name}:`, error)
        // Continue with other files
      }
    }

    // Generate project structure analysis
    const projectAnalysis = analyzeProjectStructure(processedFiles)

    return NextResponse.json({
      success: true,
      files: processedFiles.map((f) => ({
        name: f.name,
        size: f.size,
        type: f.type,
        path: f.path,
        analysis: f.analysis,
      })),
      projectAnalysis,
      totalFiles: processedFiles.length,
      totalSize: totalSize,
      message: `Successfully processed ${processedFiles.length} files`,
    })
  } catch (error) {
    console.error("File upload error:", error)
    return NextResponse.json({ error: "Failed to process uploaded files" }, { status: 500 })
  }
}

function analyzeSourceFile(filename: string, content: string) {
  const lines = content.split("\n")
  const nonEmptyLines = lines.filter((line) => line.trim().length > 0)

  // Basic code analysis
  const analysis = {
    linesOfCode: nonEmptyLines.length,
    totalLines: lines.length,
    language: getLanguageFromExtension(filename),
    complexity: "medium",
    testableElements: [] as string[],
  }

  // Language-specific analysis
  if (filename.endsWith(".java")) {
    analysis.testableElements = extractJavaElements(content)
  } else if (filename.endsWith(".py")) {
    analysis.testableElements = extractPythonElements(content)
  } else if (filename.endsWith(".js") || filename.endsWith(".ts")) {
    analysis.testableElements = extractJavaScriptElements(content)
  }

  // Determine complexity based on lines of code and patterns
  if (nonEmptyLines.length > 200) {
    analysis.complexity = "high"
  } else if (nonEmptyLines.length < 50) {
    analysis.complexity = "low"
  }

  return analysis
}

function extractJavaElements(content: string): string[] {
  const elements = []

  // Extract class names
  const classMatches = content.match(/(?:public\s+)?class\s+(\w+)/g)
  if (classMatches) {
    elements.push(...classMatches.map((match) => match.replace(/.*class\s+/, "")))
  }

  // Extract method names
  const methodMatches = content.match(/(?:public|private|protected)\s+(?:static\s+)?(?:\w+\s+)*(\w+)\s*\(/g)
  if (methodMatches) {
    elements.push(
      ...methodMatches
        .map((match) => {
          const methodName = match.match(/(\w+)\s*\(/)
          return methodName ? methodName[1] : ""
        })
        .filter(Boolean),
    )
  }

  return [...new Set(elements)] // Remove duplicates
}

function extractPythonElements(content: string): string[] {
  const elements = []

  // Extract class names
  const classMatches = content.match(/^class\s+(\w+)/gm)
  if (classMatches) {
    elements.push(...classMatches.map((match) => match.replace(/class\s+/, "").replace(/:.*/, "")))
  }

  // Extract function names
  const functionMatches = content.match(/^def\s+(\w+)/gm)
  if (functionMatches) {
    elements.push(...functionMatches.map((match) => match.replace(/def\s+/, "").replace(/\(.*/, "")))
  }

  return [...new Set(elements)]
}

function extractJavaScriptElements(content: string): string[] {
  const elements = []

  // Extract function names
  const functionMatches = content.match(/(?:function\s+(\w+)|const\s+(\w+)\s*=|let\s+(\w+)\s*=|var\s+(\w+)\s*=)/g)
  if (functionMatches) {
    functionMatches.forEach((match) => {
      const nameMatch = match.match(/(?:function\s+|const\s+|let\s+|var\s+)(\w+)/)
      if (nameMatch) {
        elements.push(nameMatch[1])
      }
    })
  }

  // Extract class names
  const classMatches = content.match(/class\s+(\w+)/g)
  if (classMatches) {
    elements.push(...classMatches.map((match) => match.replace(/class\s+/, "")))
  }

  return [...new Set(elements)]
}

function analyzeProjectStructure(files: any[]) {
  const structure = {
    totalFiles: files.length,
    languages: {} as Record<string, number>,
    directories: {} as Record<string, number>,
    testableClasses: 0,
    estimatedTestFiles: 0,
    complexity: "medium",
    recommendations: [] as string[],
  }

  files.forEach((file) => {
    // Count languages
    const lang = file.analysis.language
    structure.languages[lang] = (structure.languages[lang] || 0) + 1

    // Count directories
    const dir = file.path.split("/").slice(0, -1).join("/")
    if (dir) {
      structure.directories[dir] = (structure.directories[dir] || 0) + 1
    }

    // Count testable elements
    structure.testableClasses += file.analysis.testableElements.length
  })

  // Estimate number of test files needed
  structure.estimatedTestFiles = Math.ceil(structure.testableClasses * 0.8)

  // Determine overall complexity
  const totalLOC = files.reduce((sum, file) => sum + file.analysis.linesOfCode, 0)
  if (totalLOC > 5000) {
    structure.complexity = "high"
  } else if (totalLOC < 1000) {
    structure.complexity = "low"
  }

  // Generate recommendations
  if (structure.totalFiles > 50) {
    structure.recommendations.push("Consider generating tests in batches for better performance")
  }
  if (Object.keys(structure.languages).length > 2) {
    structure.recommendations.push("Multi-language project detected - ensure consistent testing frameworks")
  }
  if (structure.complexity === "high") {
    structure.recommendations.push("High complexity project - focus on critical path testing first")
  }

  return structure
}

function getFileType(filename: string): string {
  const extension = filename.split(".").pop()?.toLowerCase()

  const typeMap: Record<string, string> = {
    java: "Java",
    py: "Python",
    js: "JavaScript",
    ts: "TypeScript",
    jsx: "React JSX",
    tsx: "React TSX",
    cs: "C#",
    cpp: "C++",
    c: "C",
    php: "PHP",
    rb: "Ruby",
    go: "Go",
    kt: "Kotlin",
    scala: "Scala",
    swift: "Swift",
  }

  return typeMap[extension || ""] || "Unknown"
}

function getLanguageFromExtension(filename: string): string {
  const extension = filename.split(".").pop()?.toLowerCase()

  const langMap: Record<string, string> = {
    java: "java",
    py: "python",
    js: "javascript",
    ts: "javascript",
    jsx: "javascript",
    tsx: "javascript",
    cs: "csharp",
    cpp: "cpp",
    c: "c",
    php: "php",
    rb: "ruby",
    go: "go",
    kt: "kotlin",
    scala: "scala",
    swift: "swift",
  }

  return langMap[extension || ""] || "unknown"
}
