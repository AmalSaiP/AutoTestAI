"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Navigation } from "@/components/navigation"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { FileText, Download, Plus, BarChart3, TrendingUp, Eye, Share, Settings } from "lucide-react"

interface Report {
  id: string
  name: string
  description: string
  type: "summary" | "detailed" | "trend" | "custom"
  format: "pdf" | "html" | "csv" | "json"
  schedule: "manual" | "daily" | "weekly" | "monthly"
  filters: {
    timeRange: string
    environment: string
    testType: string
    projects: string[]
  }
  created_at: string
  last_generated: string
  status: "active" | "inactive"
}

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [newReport, setNewReport] = useState({
    name: "",
    description: "",
    type: "summary",
    format: "pdf",
    schedule: "manual",
    filters: {
      timeRange: "30d",
      environment: "all",
      testType: "all",
      projects: [],
    },
  })
  const { toast } = useToast()

  useEffect(() => {
    fetchReports()
  }, [])

  const fetchReports = async () => {
    try {
      const token = localStorage.getItem("token")
      const response = await fetch("/api/reports", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setReports(data.reports)
      }
    } catch (error) {
      console.error("Failed to fetch reports:", error)
    } finally {
      setLoading(false)
    }
  }

  const createReport = async () => {
    if (!newReport.name.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter a report name",
        variant: "destructive",
      })
      return
    }

    try {
      const token = localStorage.getItem("token")
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newReport),
      })

      if (response.ok) {
        const data = await response.json()
        setReports([data.report, ...reports])
        setNewReport({
          name: "",
          description: "",
          type: "summary",
          format: "pdf",
          schedule: "manual",
          filters: {
            timeRange: "30d",
            environment: "all",
            testType: "all",
            projects: [],
          },
        })
        setIsCreateDialogOpen(false)
        toast({
          title: "Report Created",
          description: "Your new report has been created successfully",
        })
      } else {
        const error = await response.json()
        toast({
          title: "Creation Failed",
          description: error.error || "Failed to create report",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Report creation error:", error)
      toast({
        title: "Error",
        description: "An error occurred while creating the report",
        variant: "destructive",
      })
    }
  }

  const generateReport = async (reportId: string) => {
    try {
      const token = localStorage.getItem("token")
      const response = await fetch(`/api/reports/${reportId}/generate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `report-${reportId}-${new Date().toISOString().split("T")[0]}.pdf`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)

        toast({
          title: "Report Generated",
          description: "Report has been generated and downloaded",
        })
      } else {
        toast({
          title: "Generation Failed",
          description: "Failed to generate report",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Report generation error:", error)
      toast({
        title: "Error",
        description: "An error occurred while generating the report",
        variant: "destructive",
      })
    }
  }

  const getReportTypeIcon = (type: string) => {
    switch (type) {
      case "summary":
        return <BarChart3 className="w-5 h-5 text-blue-500" />
      case "detailed":
        return <FileText className="w-5 h-5 text-green-500" />
      case "trend":
        return <TrendingUp className="w-5 h-5 text-purple-500" />
      case "custom":
        return <Settings className="w-5 h-5 text-orange-500" />
      default:
        return <FileText className="w-5 h-5 text-gray-500" />
    }
  }

  const getScheduleBadge = (schedule: string) => {
    const variants = {
      manual: "secondary",
      daily: "default",
      weekly: "default",
      monthly: "default",
    }

    return <Badge variant={variants[schedule as keyof typeof variants] as any}>{schedule.toUpperCase()}</Badge>
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading reports...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
            <p className="text-gray-600 mt-2">Generate and manage test execution reports</p>
          </div>

          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                New Report
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Create New Report</DialogTitle>
                <DialogDescription>Configure a new report template for your test results.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-6 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Report Name</Label>
                    <Input
                      id="name"
                      value={newReport.name}
                      onChange={(e) => setNewReport({ ...newReport, name: e.target.value })}
                      placeholder="Enter report name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="type">Report Type</Label>
                    <Select
                      value={newReport.type}
                      onValueChange={(value) => setNewReport({ ...newReport, type: value as any })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="summary">Summary Report</SelectItem>
                        <SelectItem value="detailed">Detailed Report</SelectItem>
                        <SelectItem value="trend">Trend Analysis</SelectItem>
                        <SelectItem value="custom">Custom Report</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={newReport.description}
                    onChange={(e) => setNewReport({ ...newReport, description: e.target.value })}
                    placeholder="Enter report description"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="format">Output Format</Label>
                    <Select
                      value={newReport.format}
                      onValueChange={(value) => setNewReport({ ...newReport, format: value as any })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pdf">PDF</SelectItem>
                        <SelectItem value="html">HTML</SelectItem>
                        <SelectItem value="csv">CSV</SelectItem>
                        <SelectItem value="json">JSON</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="schedule">Schedule</Label>
                    <Select
                      value={newReport.schedule}
                      onValueChange={(value) => setNewReport({ ...newReport, schedule: value as any })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">Manual</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="timeRange">Time Range</Label>
                    <Select
                      value={newReport.filters.timeRange}
                      onValueChange={(value) =>
                        setNewReport({
                          ...newReport,
                          filters: { ...newReport.filters, timeRange: value },
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7d">Last 7 days</SelectItem>
                        <SelectItem value="30d">Last 30 days</SelectItem>
                        <SelectItem value="90d">Last 90 days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="environment">Environment</Label>
                    <Select
                      value={newReport.filters.environment}
                      onValueChange={(value) =>
                        setNewReport({
                          ...newReport,
                          filters: { ...newReport.filters, environment: value },
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="development">Development</SelectItem>
                        <SelectItem value="staging">Staging</SelectItem>
                        <SelectItem value="production">Production</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="testType">Test Type</Label>
                    <Select
                      value={newReport.filters.testType}
                      onValueChange={(value) =>
                        setNewReport({
                          ...newReport,
                          filters: { ...newReport.filters, testType: value },
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="bdd">BDD</SelectItem>
                        <SelectItem value="unit">Unit</SelectItem>
                        <SelectItem value="api">API</SelectItem>
                        <SelectItem value="ui">UI</SelectItem>
                        <SelectItem value="performance">Performance</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" onClick={createReport}>
                  Create Report
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardContent className="p-6 text-center">
              <BarChart3 className="w-8 h-8 text-blue-500 mx-auto mb-2" />
              <h3 className="font-medium">Summary Report</h3>
              <p className="text-sm text-gray-500">Quick overview</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardContent className="p-6 text-center">
              <TrendingUp className="w-8 h-8 text-green-500 mx-auto mb-2" />
              <h3 className="font-medium">Trend Analysis</h3>
              <p className="text-sm text-gray-500">Performance trends</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardContent className="p-6 text-center">
              <FileText className="w-8 h-8 text-purple-500 mx-auto mb-2" />
              <h3 className="font-medium">Detailed Report</h3>
              <p className="text-sm text-gray-500">Comprehensive analysis</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardContent className="p-6 text-center">
              <Settings className="w-8 h-8 text-orange-500 mx-auto mb-2" />
              <h3 className="font-medium">Custom Report</h3>
              <p className="text-sm text-gray-500">Build your own</p>
            </CardContent>
          </Card>
        </div>

        {/* Reports List */}
        <Card>
          <CardHeader>
            <CardTitle>Report Templates</CardTitle>
            <CardDescription>Manage your report templates and schedules</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {reports.map((report) => (
                <div
                  key={report.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center space-x-4">
                    {getReportTypeIcon(report.type)}
                    <div>
                      <h3 className="font-medium">{report.name}</h3>
                      <p className="text-sm text-gray-500">{report.description}</p>
                      <div className="flex items-center space-x-2 mt-1">
                        <Badge variant="outline">{report.format.toUpperCase()}</Badge>
                        {getScheduleBadge(report.schedule)}
                        <span className="text-xs text-gray-400">
                          Last generated:{" "}
                          {report.last_generated ? new Date(report.last_generated).toLocaleDateString() : "Never"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm">
                      <Eye className="w-4 h-4 mr-2" />
                      Preview
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => generateReport(report.id)}>
                      <Download className="w-4 h-4 mr-2" />
                      Generate
                    </Button>
                    <Button variant="outline" size="sm">
                      <Share className="w-4 h-4 mr-2" />
                      Share
                    </Button>
                  </div>
                </div>
              ))}

              {reports.length === 0 && (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No reports yet</h3>
                  <p className="text-gray-500 mb-6">Create your first report template to get started</p>
                  <Button onClick={() => setIsCreateDialogOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Your First Report
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
