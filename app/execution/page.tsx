"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Navigation } from "@/components/navigation"
import { useToast } from "@/hooks/use-toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Play, RefreshCw, Clock, CheckCircle, XCircle, AlertCircle, Download } from "lucide-react"

interface TestCase {
  id: string
  name: string
  type: string
  project_name: string
  content: string
  created_at: string
}

interface TestExecution {
  id: string
  test_case_id: string
  test_name: string
  status: "running" | "passed" | "failed" | "skipped"
  duration: number
  environment: string
  logs: string
  created_at: string
}

export default function ExecutionPage() {
  const [testCases, setTestCases] = useState<TestCase[]>([])
  const [executions, setExecutions] = useState<TestExecution[]>([])
  const [selectedTests, setSelectedTests] = useState<string[]>([])
  const [environment, setEnvironment] = useState("development")
  const [loading, setLoading] = useState(true)
  const [executing, setExecuting] = useState(false)
  const [selectedExecution, setSelectedExecution] = useState<TestExecution | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    fetchTestCases()
    fetchExecutions()
  }, [])

  const fetchTestCases = async () => {
    try {
      const token = localStorage.getItem("token")
      const response = await fetch("/api/test-cases", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setTestCases(data.testCases)
      }
    } catch (error) {
      console.error("Failed to fetch test cases:", error)
    }
  }

  const fetchExecutions = async () => {
    try {
      const token = localStorage.getItem("token")
      const response = await fetch("/api/executions", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setExecutions(data.executions)
      }
    } catch (error) {
      console.error("Failed to fetch executions:", error)
    } finally {
      setLoading(false)
    }
  }

  const executeTests = async () => {
    if (selectedTests.length === 0) {
      toast({
        title: "No Tests Selected",
        description: "Please select at least one test to execute",
        variant: "destructive",
      })
      return
    }

    setExecuting(true)

    try {
      const token = localStorage.getItem("token")
      const response = await fetch("/api/executions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          testCaseIds: selectedTests,
          environment,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        toast({
          title: "Tests Executed",
          description: `Started execution of ${selectedTests.length} tests`,
        })
        fetchExecutions()
        setSelectedTests([])
      } else {
        const error = await response.json()
        toast({
          title: "Execution Failed",
          description: error.error || "Failed to execute tests",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Test execution error:", error)
      toast({
        title: "Error",
        description: "An error occurred during test execution",
        variant: "destructive",
      })
    } finally {
      setExecuting(false)
    }
  }

  const toggleTestSelection = (testId: string) => {
    setSelectedTests((prev) => (prev.includes(testId) ? prev.filter((id) => id !== testId) : [...prev, testId]))
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "running":
        return <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />
      case "passed":
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case "failed":
        return <XCircle className="w-4 h-4 text-red-500" />
      case "skipped":
        return <AlertCircle className="w-4 h-4 text-yellow-500" />
      default:
        return <Clock className="w-4 h-4 text-gray-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    const variants = {
      running: "default",
      passed: "default",
      failed: "destructive",
      skipped: "secondary",
    }

    return <Badge variant={variants[status as keyof typeof variants] as any}>{status.toUpperCase()}</Badge>
  }

  const formatDuration = (duration: number) => {
    if (duration < 1000) return `${duration}ms`
    return `${(duration / 1000).toFixed(2)}s`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading test execution...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Test Execution</h1>
          <p className="text-gray-600 mt-2">Execute and monitor your test cases</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Test Selection Panel */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Available Test Cases</CardTitle>
                    <CardDescription>Select tests to execute</CardDescription>
                  </div>
                  <div className="flex items-center space-x-4">
                    <Select value={environment} onValueChange={setEnvironment}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Environment" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="development">Development</SelectItem>
                        <SelectItem value="staging">Staging</SelectItem>
                        <SelectItem value="production">Production</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={executeTests} disabled={executing || selectedTests.length === 0}>
                      {executing ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          Executing...
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 mr-2" />
                          Execute ({selectedTests.length})
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {testCases.map((testCase) => (
                    <div
                      key={testCase.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedTests.includes(testCase.id)
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                      onClick={() => toggleTestSelection(testCase.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3">
                            <input
                              type="checkbox"
                              checked={selectedTests.includes(testCase.id)}
                              onChange={() => toggleTestSelection(testCase.id)}
                              className="rounded border-gray-300"
                            />
                            <div>
                              <h3 className="font-medium">{testCase.name}</h3>
                              <p className="text-sm text-gray-500">
                                {testCase.project_name} • {testCase.type.toUpperCase()}
                              </p>
                            </div>
                          </div>
                        </div>
                        <Badge variant="outline">{testCase.type}</Badge>
                      </div>
                    </div>
                  ))}

                  {testCases.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-gray-500">No test cases available</p>
                      <p className="text-sm text-gray-400">Generate some tests first</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Execution History */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Recent Executions</CardTitle>
                <CardDescription>Latest test execution results</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {executions.slice(0, 10).map((execution) => (
                    <div
                      key={execution.id}
                      className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                      onClick={() => setSelectedExecution(execution)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(execution.status)}
                          <span className="font-medium text-sm">{execution.test_name}</span>
                        </div>
                        {getStatusBadge(execution.status)}
                      </div>
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>{execution.environment}</span>
                        <span>{formatDuration(execution.duration)}</span>
                      </div>
                    </div>
                  ))}

                  {executions.length === 0 && (
                    <div className="text-center py-8">
                      <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">No executions yet</p>
                      <p className="text-sm text-gray-400">Execute some tests to see results</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Execution Details Dialog */}
        <Dialog open={!!selectedExecution} onOpenChange={() => setSelectedExecution(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                {selectedExecution && getStatusIcon(selectedExecution.status)}
                <span>Execution Details</span>
              </DialogTitle>
              <DialogDescription>
                {selectedExecution?.test_name} • {selectedExecution?.environment}
              </DialogDescription>
            </DialogHeader>

            {selectedExecution && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Status</Label>
                    <div className="mt-1">{getStatusBadge(selectedExecution.status)}</div>
                  </div>
                  <div>
                    <Label>Duration</Label>
                    <p className="mt-1 text-sm">{formatDuration(selectedExecution.duration)}</p>
                  </div>
                  <div>
                    <Label>Environment</Label>
                    <p className="mt-1 text-sm">{selectedExecution.environment}</p>
                  </div>
                  <div>
                    <Label>Executed At</Label>
                    <p className="mt-1 text-sm">{new Date(selectedExecution.created_at).toLocaleString()}</p>
                  </div>
                </div>

                <div>
                  <Label>Execution Logs</Label>
                  <Textarea value={selectedExecution.logs} readOnly className="mt-2 font-mono text-sm" rows={15} />
                </div>

                <div className="flex justify-end space-x-2">
                  <Button variant="outline" size="sm">
                    <Download className="w-4 h-4 mr-2" />
                    Download Logs
                  </Button>
                  <Button variant="outline" size="sm">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Re-execute
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
