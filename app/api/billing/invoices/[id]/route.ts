import { type NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/auth"
import { getDatabase } from "@/lib/database"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
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
    const invoiceId = params.id

    // Get invoice
    const invoice = db.prepare("SELECT * FROM invoices WHERE id = ? AND user_id = ?").get(invoiceId, decoded.id) as any

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
    }

    // Generate mock PDF content
    const pdfContent = generateInvoicePDF(invoice, decoded)

    const buffer = Buffer.from(pdfContent, "utf-8")

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="invoice-${invoiceId}.pdf"`,
      },
    })
  } catch (error) {
    console.error("Invoice download error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

function generateInvoicePDF(invoice: any, user: any): string {
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
/Length 300
>>
stream
BT
/F1 16 Tf
50 750 Td
(INVOICE) Tj
0 -30 Td
/F1 12 Tf
(AutoTest AI Platform) Tj
0 -20 Td
(Invoice ID: ${invoice.id}) Tj
0 -20 Td
(Date: ${new Date(invoice.invoice_date).toLocaleDateString()}) Tj
0 -20 Td
(Customer: ${user.email}) Tj
0 -40 Td
(Description: Monthly Subscription) Tj
0 -20 Td
(Amount: $${invoice.amount}) Tj
0 -20 Td
(Status: ${invoice.status.toUpperCase()}) Tj
0 -40 Td
(Thank you for using AutoTest AI!) Tj
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
0000000626 00000 n 
trailer
<<
/Size 6
/Root 1 0 R
>>
startxref
725
%%EOF
`
}
