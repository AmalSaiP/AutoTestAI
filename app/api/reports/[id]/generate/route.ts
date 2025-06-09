import { type NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/auth"
import { getDatabase } from "@/lib/database"

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
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

    const db = getDatabase()
    const reportId = params.id

    // Get report details
    const report = db.prepare("SELECT * FROM reports WHERE id = ? AND created_by = ?").get(reportId, decoded.id) as any

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 })
    }

    // Update last_generated timestamp
    db.prepare("UPDATE reports SET last_generated = datetime('now') WHERE id = ?").run(reportId)

    // Generate mock PDF content
    const pdfContent = generateReportContent(report, decoded.id)

    // Create a blob response
    const buffer = Buffer.from(pdfContent, "utf-8")

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="report-${reportId}.pdf"`,
      },
    })
  } catch (error) {
    console.error("Report generation error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

function generateReportContent(report: any, userId: string): string {
  const filters = JSON.parse(report.filters || "{}")

  return `
%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
/Resources <<
/Font <<
/F1 5 0 R
>>
>>
>>
endobj

4 0 obj
<<
/Length 200
>>
stream
BT
/F1 12 Tf
50 750 Td
(AutoTest AI - ${report.type.toUpperCase()} REPORT) Tj
0 -20 Td
(Report: ${report.name}) Tj
0 -20 Td
(Generated: ${new Date().toISOString()}) Tj
0 -20 Td
(Type: ${report.type}) Tj
0 -20 Td
(Format: ${report.format}) Tj
0 -20 Td
(Time Range: ${filters.timeRange || "N/A"}) Tj
0 -20 Td
(Environment: ${filters.environment || "All"}) Tj
0 -20 Td
(Test Type: ${filters.testType || "All"}) Tj
ET
endstream
endobj

5 0 obj
<<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
endobj

xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000274 00000 n 
0000000526 00000 n 
trailer
<<
/Size 6
/Root 1 0 R
>>
startxref
625
%%EOF
`
}
