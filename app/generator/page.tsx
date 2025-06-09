"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Navigation } from "@/components/navigation"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Download, Copy, FileText, Code, Globe, GitBranch, Database, X, Upload } from "lucide-react"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { tomorrow } from "react-syntax-highlighter/dist/esm/styles/prism"

interface GeneratedTest {
  type: string
  content: string
  filename: string
  description?: string
  category?: string
}

interface UploadedFile {
  name: string
  size: number
  content: string
  type: string
  lastModified: number
}

export default function TestGeneratorPage() {
  const [inputType, setInputType] = useState<
    "user_story" | "code" | "api_spec" | "git_repo" | "postman_collection" | "web_url"
  >("user_story")
  const [inputData, setInputData] = useState("")
  const [selectedTestTypes, setSelectedTestTypes] = useState<string[]>(["bdd"])
  const [language, setLanguage] = useState("java")
  const [loading, setLoading] = useState(false)
  const [generatedTests, setGeneratedTests] = useState<GeneratedTest[]>([])
  const { toast } = useToast()

  // Add these state variables after the existing ones
  const [aiModel, setAiModel] = useState("gemini-1.5-pro") // Updated default value
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [uploadProgress, setUploadProgress] = useState<number>(0)
  const [isUploading, setIsUploading] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)

  const inputTypes = [
    { id: "user_story", label: "User Story", icon: FileText, description: "Business requirements and user stories" },
    { id: "code", label: "Code Snippet", icon: Code, description: "Source code for unit testing" },
    { id: "git_repo", label: "Git Repository", icon: GitBranch, description: "Complete project analysis" },
    {
      id: "postman_collection",
      label: "Postman Collection",
      icon: Database,
      description: "API testing from collections",
    },
    { id: "web_url", label: "Web URL", icon: Globe, description: "UI testing from web pages" },
    { id: "api_spec", label: "API Spec/cURL", icon: Code, description: "API specifications and cURL commands" },
  ]

  const testTypes = [
    { id: "bdd", label: "BDD (Cucumber)", description: "Behavior-driven development scenarios with step definitions" },
    { id: "unit", label: "Unit Test (JUnit/TestNG)", description: "Comprehensive unit testing for all classes" },
    { id: "api", label: "API Test (RestAssured)", description: "Complete API endpoint testing with RestAssured" },
    { id: "ui", label: "UI Test (Selenium)", description: "Page Object Model with Selenium WebDriver" },
    { id: "performance", label: "Performance Test (JMeter)", description: "Load and performance testing scripts" },
  ]

  const handleTestTypeChange = (testType: string, checked: boolean) => {
    if (checked) {
      setSelectedTestTypes([...selectedTestTypes, testType])
    } else {
      setSelectedTestTypes(selectedTestTypes.filter((t) => t !== testType))
    }
  }

  const generateTests = async () => {
    if (!inputData.trim() && uploadedFiles.length === 0) {
      toast({
        title: "Input Required",
        description: "Please provide input data or upload files for test generation",
        variant: "destructive",
      })
      return
    }

    if (selectedTestTypes.length === 0) {
      toast({
        title: "Test Type Required",
        description: "Please select at least one test type",
        variant: "destructive",
      })
      return
    }

    setLoading(true)

    try {
      // Combine manual input and uploaded files
      let combinedInput = inputData

      if (uploadedFiles.length > 0) {
        const fileContents = uploadedFiles.map((file) => `// File: ${file.name}\n${file.content}\n\n`).join("")
        combinedInput = combinedInput + "\n\n" + fileContents
      }

      const token = localStorage.getItem("token")
      const response = await fetch("/api/generate-tests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          inputType,
          inputData: combinedInput,
          testTypes: selectedTestTypes,
          language,
          additionalContext: getContextForInputType(inputType),
          framework: getDefaultFramework(language),
          testingLibrary: getDefaultTestingLibrary(language),
          aiModel: aiModel || undefined,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setGeneratedTests(data.tests)
        toast({
          title: "Tests Generated Successfully",
          description: `Generated ${data.tests.length} test files`,
        })
      } else {
        const error = await response.json()
        toast({
          title: "Generation Failed",
          description: error.error || "Failed to generate tests",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Test generation error:", error)
      toast({
        title: "Error",
        description: "An error occurred during test generation",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = (content: string) => {
    navigator.clipboard.writeText(content)
    toast({
      title: "Copied",
      description: "Test content copied to clipboard",
    })
  }

  const downloadTest = (test: GeneratedTest) => {
    const blob = new Blob([test.content], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = test.filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const downloadAllTests = () => {
    generatedTests.forEach((test) => downloadTest(test))
    toast({
      title: "Downloaded",
      description: `Downloaded ${generatedTests.length} test files`,
    })
  }

  const getContextForInputType = (type: string): string => {
    const contexts = {
      user_story: "Generate comprehensive test scenarios covering all user acceptance criteria and edge cases.",
      code: "Generate complete unit tests with mocking, edge cases, and exception handling.",
      git_repo: "Analyze the entire project structure and generate comprehensive test suites for all testable classes.",
      postman_collection:
        "Generate complete BDD scenarios with step definitions, utils, and runner files using RestAssured.",
      web_url: "Generate Page Object Model classes and comprehensive UI test automation scripts.",
      api_spec: "Generate complete API test automation with authentication, validation, and error handling.",
    }
    return contexts[type as keyof typeof contexts] || "Generate production-ready, comprehensive test cases."
  }

  const handleFileUpload = async (files: FileList | File[]) => {
    setIsUploading(true)
    setUploadProgress(0)

    const fileArray = Array.from(files)
    const validFiles: UploadedFile[] = []

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
    const maxFileSize = 10 * 1024 * 1024 // 10MB limit

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i]
      const isValidSize = file.size <= maxFileSize
      const isValidType = validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext))

      if (!isValidType) {
        continue // Skip invalid file types
      }

      if (!isValidSize) {
        toast({
          title: "File Too Large",
          description: `File ${file.name} is too large. Maximum size is 10MB.`,
          variant: "destructive",
        })
        continue
      }

      try {
        // Read file content
        const content = await readFileContent(file)

        validFiles.push({
          name: file.name,
          size: file.size,
          content: content,
          type: getFileType(file.name),
          lastModified: file.lastModified,
        })

        // Update progress
        setUploadProgress(Math.round(((i + 1) / fileArray.length) * 100))
      } catch (error) {
        console.error(`Error reading file ${file.name}:`, error)
        toast({
          title: "File Read Error",
          description: `Could not read file ${file.name}`,
          variant: "destructive",
        })
      }
    }

    if (validFiles.length !== fileArray.length) {
      toast({
        title: "Some Files Skipped",
        description: `${fileArray.length - validFiles.length} files were skipped. Only source code files under 10MB are allowed.`,
        variant: "destructive",
      })
    }

    // Add to uploaded files
    setUploadedFiles((prev) => [...prev, ...validFiles])

    // Update input data with file contents
    const fileContents = validFiles.map((file) => `// File: ${file.name}\n${file.content}\n\n`).join("")

    setInputData((prev) => {
      const newContent = prev + "\n\n" + fileContents
      return newContent.trim()
    })

    setIsUploading(false)
    setUploadProgress(0)

    if (validFiles.length > 0) {
      toast({
        title: "Files Uploaded Successfully",
        description: `${validFiles.length} files uploaded and ready for test generation`,
      })
    }
  }

  const readFileContent = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const content = e.target?.result as string
        resolve(content || "")
      }
      reader.onerror = () => {
        reject(new Error("Failed to read file"))
      }
      reader.readAsText(file)
    })
  }

  const getFileType = (filename: string): string => {
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

  const removeUploadedFile = (index: number) => {
    const fileToRemove = uploadedFiles[index]
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index))

    // Remove file content from input data
    const fileMarker = `// File: ${fileToRemove.name}`
    const lines = inputData.split("\n")
    const startIndex = lines.findIndex((line) => line.includes(fileMarker))

    if (startIndex !== -1) {
      // Find the end of this file's content (next file marker or end of string)
      let endIndex = lines.length
      for (let i = startIndex + 1; i < lines.length; i++) {
        if (lines[i].startsWith("// File:")) {
          endIndex = i
          break
        }
      }

      // Remove the file content
      const newLines = [...lines.slice(0, startIndex), ...lines.slice(endIndex)]
      setInputData(newLines.join("\n").trim())
    }

    toast({
      title: "File Removed",
      description: `${fileToRemove.name} has been removed`,
    })
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileUpload(files)
    }
  }

  const renderInputPanel = () => {
    const currentInputType = inputTypes.find((type) => type.id === inputType)
    const Icon = currentInputType?.icon || FileText

    switch (inputType) {
      case "user_story":
        return (
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Icon className="w-5 h-5 text-blue-600" />
              <Label htmlFor="user-story" className="text-base font-medium">
                User Story
              </Label>
            </div>
            <Textarea
              id="user-story"
              placeholder="As a user, I want to be able to login to the system so that I can access my dashboard..."
              value={inputData}
              onChange={(e) => setInputData(e.target.value)}
              rows={6}
              className="min-h-[150px]"
            />
            <p className="text-sm text-gray-500">
              Provide detailed user stories with acceptance criteria for comprehensive BDD scenario generation.
            </p>
          </div>
        )

      case "code":
        return (
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Icon className="w-5 h-5 text-green-600" />
              <Label htmlFor="code-snippet" className="text-base font-medium">
                Source Code
              </Label>
            </div>

            {/* File Upload Section */}
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                isDragOver ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400 hover:bg-gray-50"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input
                type="file"
                id="file-upload"
                multiple
                accept=".java,.py,.js,.ts,.jsx,.tsx,.cs,.cpp,.c,.php,.rb,.go,.kt,.scala,.swift,text/x-java-source,application/java"
                onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                className="hidden"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <div className="space-y-2">
                  <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                    <Upload className="w-6 h-6 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Upload source code files</p>
                    <p className="text-xs text-gray-500">Drag and drop or click to browse</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Supports: .java, .py, .js, .ts, .jsx, .tsx, .cs, .cpp, .c, .php, .rb, .go, .kt, .scala, .swift
                    </p>
                  </div>
                </div>
              </label>
            </div>

            {/* Upload Progress */}
            {isUploading && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Processing files...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Uploaded Files List */}
            {uploadedFiles.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Uploaded Files ({uploadedFiles.length})</Label>
                <div className="max-h-40 overflow-y-auto space-y-2 border rounded-lg p-3 bg-gray-50">
                  {uploadedFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between bg-white p-3 rounded border">
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
                            <Code className="w-4 h-4 text-blue-600" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                          <div className="flex items-center space-x-2 text-xs text-gray-500">
                            <span>{file.type}</span>
                            <span>•</span>
                            <span>{(file.size / 1024).toFixed(1)} KB</span>
                            <span>•</span>
                            <span>{file.content.split("\n").length} lines</span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => removeUploadedFile(index)}
                        className="flex-shrink-0 ml-2 p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                        title="Remove file"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Manual Code Input */}
            <div>
              <Label htmlFor="code-snippet" className="text-sm font-medium">
                Or paste code manually
              </Label>
              <Textarea
                id="code-snippet"
                placeholder="public class UserService {
    private UserRepository userRepository;
    
    public User createUser(String email, String name) {
        // implementation
    }
}"
                value={inputData}
                onChange={(e) => setInputData(e.target.value)}
                rows={10}
                className="font-mono text-sm mt-2"
              />
            </div>

            <p className="text-sm text-gray-500">
              Upload multiple source code files or paste code to generate comprehensive unit tests with mocking and edge
              cases.
            </p>
          </div>
        )

      case "git_repo":
        return (
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Icon className="w-5 h-5 text-purple-600" />
              <Label htmlFor="git-repo" className="text-base font-medium">
                Project Source
              </Label>
            </div>

            <Tabs defaultValue="url" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="url">Git Repository URL</TabsTrigger>
                <TabsTrigger value="upload">Upload Project Files</TabsTrigger>
              </TabsList>

              <TabsContent value="url" className="space-y-4">
                <Input
                  id="git-repo"
                  placeholder="https://github.com/username/spring-boot-project"
                  value={inputData}
                  onChange={(e) => setInputData(e.target.value)}
                />
                <p className="text-sm text-gray-500">
                  Provide a Git repository URL for complete project analysis and comprehensive test suite generation.
                </p>
              </TabsContent>

              <TabsContent value="upload" className="space-y-4">
                {/* Project Upload Section */}
                <div
                  className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                    isDragOver
                      ? "border-purple-500 bg-purple-50"
                      : "border-gray-300 hover:border-gray-400 hover:bg-gray-50"
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <input
                    type="file"
                    id="project-upload"
                    multiple
                    accept=".java,.py,.js,.ts,.jsx,.tsx,.cs,.cpp,.c,.php,.rb,.go,.kt,.scala,.swift,text/x-java-source,application/java"
                    onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                    className="hidden"
                  />
                  <label htmlFor="project-upload" className="cursor-pointer">
                    <div className="space-y-2">
                      <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                        <Upload className="w-6 h-6 text-gray-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">Upload project files</p>
                        <p className="text-xs text-gray-500">Select multiple files from your project</p>
                        <p className="text-xs text-gray-400 mt-1">
                          Will analyze project structure and generate comprehensive test suites
                        </p>
                      </div>
                    </div>
                  </label>
                </div>

                {/* Upload Progress */}
                {isUploading && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Analyzing project structure...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Project Analysis Summary */}
                {uploadedFiles.length > 0 && (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <h4 className="font-medium text-purple-900 mb-2">Project Analysis</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-purple-700">Total Files:</span>
                        <span className="ml-2 font-medium">{uploadedFiles.length}</span>
                      </div>
                      <div>
                        <span className="text-purple-700">File Types:</span>
                        <span className="ml-2 font-medium">
                          {Array.from(new Set(uploadedFiles.map((f) => f.type))).join(", ")}
                        </span>
                      </div>
                      <div>
                        <span className="text-purple-700">Total Size:</span>
                        <span className="ml-2 font-medium">
                          {(uploadedFiles.reduce((sum, f) => sum + f.size, 0) / 1024 / 1024).toFixed(2)} MB
                        </span>
                      </div>
                      <div>
                        <span className="text-purple-700">Lines of Code:</span>
                        <span className="ml-2 font-medium">
                          {uploadedFiles.reduce((sum, f) => sum + f.content.split("\n").length, 0)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <p className="text-sm text-gray-500">
                  Upload your project files to generate comprehensive test suites for all classes and components.
                </p>
              </TabsContent>
            </Tabs>
          </div>
        )

      case "postman_collection":
        return (
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Icon className="w-5 h-5 text-orange-600" />
              <Label htmlFor="postman-collection" className="text-base font-medium">
                Postman Collection
              </Label>
            </div>
            <Textarea
              id="postman-collection"
              placeholder='Paste your Postman collection JSON or provide collection details:

{
  "info": {
    "name": "User API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Create User",
      "request": {
        "method": "POST",
        "url": "{{baseUrl}}/api/users",
        "body": {
          "mode": "raw",
          "raw": "{\n  "name": "John Doe",\n  "email": "john@example.com"\n}"
        }
      }
    }
  ]
}'
              value={inputData}
              onChange={(e) => setInputData(e.target.value)}
              rows={12}
              className="font-mono text-sm"
            />
            <p className="text-sm text-gray-500">
              Paste your Postman collection JSON to generate BDD scenarios, step definitions, utils, and runner files.
            </p>
          </div>
        )

      case "web_url":
        return (
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Icon className="w-5 h-5 text-blue-600" />
              <Label htmlFor="web-url" className="text-base font-medium">
                Web Page URL
              </Label>
            </div>
            <Input
              id="web-url"
              placeholder="https://example.com/login"
              value={inputData}
              onChange={(e) => setInputData(e.target.value)}
            />
            <p className="text-sm text-gray-500">
              Provide a web page URL to generate Page Object Model classes and comprehensive UI automation scripts.
            </p>
          </div>
        )

      case "api_spec":
        return (
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Icon className="w-5 h-5 text-red-600" />
              <Label htmlFor="curl-command" className="text-base font-medium">
                API Specification or cURL Command
              </Label>
            </div>
            <Textarea
              id="curl-command"
              placeholder='curl -X POST "https://api.example.com/users" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer token" \
  -d "{
    "name": "John Doe",
    "email": "john@example.com"
  }"

Or provide OpenAPI/Swagger specification...'
              value={inputData}
              onChange={(e) => setInputData(e.target.value)}
              rows={8}
              className="font-mono text-sm"
            />
            <p className="text-sm text-gray-500">
              Provide cURL commands or API specifications for comprehensive API and performance testing.
            </p>
          </div>
        )
    }
  }

  const getDefaultFramework = (lang: string) => {
    const frameworks = {
      java: "Spring Boot",
      python: "Django/Flask",
      javascript: "React/Node.js",
    }
    return frameworks[lang as keyof typeof frameworks] || "Generic"
  }

  const getDefaultTestingLibrary = (lang: string) => {
    const libraries = {
      java: "JUnit 5 + Mockito + RestAssured",
      python: "pytest + unittest.mock + requests",
      javascript: "Jest + Testing Library + Selenium",
    }
    return libraries[lang as keyof typeof libraries] || "Standard"
  }

  const groupTestsByCategory = (tests: GeneratedTest[]) => {
    const grouped = tests.reduce(
      (acc, test) => {
        const category = test.category || "main"
        if (!acc[category]) acc[category] = []
        acc[category].push(test)
        return acc
      },
      {} as Record<string, GeneratedTest[]>,
    )

    return grouped
  }

  const getCategoryLabel = (category: string) => {
    const labels = {
      main: "Main Tests",
      step_definitions: "Step Definitions",
      utils: "Utility Classes",
      runner: "Test Runners",
      page_objects: "Page Objects",
      config: "Configuration",
    }
    return labels[category as keyof typeof labels] || category
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">AI Test Generator</h1>
          <p className="text-gray-600 mt-2">Generate comprehensive test automation suites using AI</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Input Panel */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Input Source</CardTitle>
                <CardDescription>Choose your input type and provide the source</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label className="text-base font-medium mb-3 block">Input Type</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {inputTypes.map((type) => {
                      const Icon = type.icon
                      return (
                        <button
                          key={type.id}
                          onClick={() => setInputType(type.id as any)}
                          className={`p-3 border rounded-lg text-left transition-colors ${
                            inputType === type.id
                              ? "border-blue-500 bg-blue-50 text-blue-700"
                              : "border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          <div className="flex items-center space-x-2 mb-1">
                            <Icon className="w-4 h-4" />
                            <span className="font-medium text-sm">{type.label}</span>
                          </div>
                          <p className="text-xs text-gray-500">{type.description}</p>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="mt-6">{renderInputPanel()}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Test Configuration</CardTitle>
                <CardDescription>Select test types and language preferences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label className="text-base font-medium">Test Types</Label>
                  <div className="mt-3 space-y-3">
                    {testTypes.map((testType) => (
                      <div key={testType.id} className="flex items-start space-x-3">
                        <Checkbox
                          id={testType.id}
                          checked={selectedTestTypes.includes(testType.id)}
                          onCheckedChange={(checked) => handleTestTypeChange(testType.id, checked as boolean)}
                        />
                        <div className="grid gap-1.5 leading-none">
                          <Label
                            htmlFor={testType.id}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            {testType.label}
                          </Label>
                          <p className="text-xs text-muted-foreground">{testType.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <Label htmlFor="language">Programming Language</Label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="java">Java (JUnit 5 + RestAssured + Selenium)</SelectItem>
                      <SelectItem value="python">Python (pytest + requests + Selenium)</SelectItem>
                      <SelectItem value="javascript">JavaScript (Jest + Axios + WebDriver)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Add this section in the Test Configuration card, after the language selection: */}
                <div>
                  <Label htmlFor="ai-model">AI Model</Label>
                  <Select value={aiModel} onValueChange={setAiModel}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select AI model" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gemini-1.5-pro">Gemini 1.5 Pro (Default)</SelectItem>
                      <SelectItem value="gemini-1.5-flash">Gemini 1.5 Flash</SelectItem>
                      <SelectItem value="gemini-pro">Gemini Pro</SelectItem>
                      <SelectItem value="gemini-1.5-pro-002">Gemini 1.5 Pro 002</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-gray-500 mt-1">
                    Powered by Google AI Studio - Fast, reliable, and cost-effective AI generation
                  </p>
                </div>

                <Button
                  onClick={generateTests}
                  disabled={
                    loading || (!inputData.trim() && uploadedFiles.length === 0) || selectedTestTypes.length === 0
                  }
                  className="w-full"
                  size="lg"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating Comprehensive Tests...
                    </>
                  ) : (
                    "🚀 Generate Complete Test Suite"
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Preview Panel */}
          <div>
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Generated Test Suite
                  {generatedTests.length > 0 && (
                    <Button variant="outline" size="sm" onClick={downloadAllTests}>
                      <Download className="w-4 h-4 mr-2" />
                      Download All
                    </Button>
                  )}
                </CardTitle>
                <CardDescription>
                  {generatedTests.length > 0
                    ? `${generatedTests.length} test files generated`
                    : "Generated tests will appear here"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {generatedTests.length > 0 ? (
                  <div className="space-y-6">
                    {Object.entries(groupTestsByCategory(generatedTests)).map(([category, tests]) => (
                      <div key={category} className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
                          {getCategoryLabel(category)}
                        </h3>
                        <Tabs defaultValue={tests[0]?.filename} className="w-full">
                          <TabsList className="grid w-full grid-cols-auto overflow-x-auto">
                            {tests.map((test) => (
                              <TabsTrigger key={test.filename} value={test.filename} className="text-xs">
                                {test.filename}
                              </TabsTrigger>
                            ))}
                          </TabsList>
                          {tests.map((test) => (
                            <TabsContent key={test.filename} value={test.filename} className="mt-4">
                              <div className="space-y-4">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <h4 className="text-lg font-medium">{test.filename}</h4>
                                    {test.description && (
                                      <p className="text-sm text-gray-600 mt-1">{test.description}</p>
                                    )}
                                  </div>
                                  <div className="flex space-x-2">
                                    <Button variant="outline" size="sm" onClick={() => copyToClipboard(test.content)}>
                                      <Copy className="w-4 h-4 mr-2" />
                                      Copy
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => downloadTest(test)}>
                                      <Download className="w-4 h-4 mr-2" />
                                      Download
                                    </Button>
                                  </div>
                                </div>
                                <div className="border rounded-lg overflow-hidden">
                                  <SyntaxHighlighter
                                    language={
                                      test.type === "bdd"
                                        ? "gherkin"
                                        : test.filename.endsWith(".xml")
                                          ? "xml"
                                          : language
                                    }
                                    style={tomorrow}
                                    customStyle={{
                                      margin: 0,
                                      maxHeight: "500px",
                                      fontSize: "14px",
                                    }}
                                  >
                                    {test.content}
                                  </SyntaxHighlighter>
                                </div>
                              </div>
                            </TabsContent>
                          ))}
                        </Tabs>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="w-24 h-24 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                      <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No tests generated yet</h3>
                    <p className="text-gray-500">
                      Select your input type, provide the source, and click generate to see comprehensive test
                      automation suites
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
