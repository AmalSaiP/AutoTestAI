import { type NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/auth"
import { getDatabase } from "@/lib/database"

export async function GET(request: NextRequest) {
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

    // Create billing tables if they don't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_billing (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        user_id TEXT UNIQUE NOT NULL,
        current_plan TEXT DEFAULT 'free',
        billing_cycle TEXT DEFAULT 'monthly',
        next_billing_date TEXT,
        amount REAL DEFAULT 0,
        payment_method_id TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `)

    db.exec(`
      CREATE TABLE IF NOT EXISTS payment_methods (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        user_id TEXT NOT NULL,
        type TEXT DEFAULT 'card',
        last_four TEXT,
        expires TEXT,
        is_default BOOLEAN DEFAULT TRUE,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `)

    db.exec(`
      CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        user_id TEXT NOT NULL,
        amount REAL NOT NULL,
        status TEXT DEFAULT 'paid',
        invoice_date TEXT DEFAULT (datetime('now')),
        download_url TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `)

    // Get or create billing info
    let billing = db.prepare("SELECT * FROM user_billing WHERE user_id = ?").get(decoded.id) as any

    if (!billing) {
      // Create default billing record
      const stmt = db.prepare(`
        INSERT INTO user_billing (user_id, current_plan, next_billing_date, amount)
        VALUES (?, ?, ?, ?)
      `)

      const nextMonth = new Date()
      nextMonth.setMonth(nextMonth.getMonth() + 1)

      stmt.run(decoded.id, "free", nextMonth.toISOString(), 0)
      billing = db.prepare("SELECT * FROM user_billing WHERE user_id = ?").get(decoded.id) as any
    }

    // Get payment method
    const paymentMethod = db
      .prepare("SELECT * FROM payment_methods WHERE user_id = ? AND is_default = TRUE")
      .get(decoded.id) as any

    // Get usage stats
    const testsGenerated = db
      .prepare("SELECT COUNT(*) as count FROM test_cases WHERE created_by = ?")
      .get(decoded.id) as { count: number }
    const teamMembers = db
      .prepare("SELECT COUNT(*) as count FROM team_members WHERE team_owner_id = ?")
      .get(decoded.id) as { count: number }

    // Get plan limits
    const planLimits = {
      free: { tests: 500, members: 1, storage: 1 },
      basic: { tests: 5000, members: 5, storage: 10 },
      pro: { tests: 25000, members: 15, storage: 100 },
      enterprise: { tests: 999999, members: 999999, storage: 999999 },
    }

    const currentPlanLimits = planLimits[billing.current_plan as keyof typeof planLimits] || planLimits.free

    // Get recent invoices
    const invoices = db
      .prepare(`
      SELECT * FROM invoices 
      WHERE user_id = ? 
      ORDER BY invoice_date DESC 
      LIMIT 10
    `)
      .all(decoded.id)

    // Add some mock invoices if none exist
    if (invoices.length === 0 && billing.current_plan !== "free") {
      const mockInvoices = [
        { amount: billing.amount, status: "paid", days_ago: 30 },
        { amount: billing.amount, status: "paid", days_ago: 60 },
        { amount: billing.amount, status: "paid", days_ago: 90 },
      ]

      for (const invoice of mockInvoices) {
        const invoiceDate = new Date()
        invoiceDate.setDate(invoiceDate.getDate() - invoice.days_ago)

        const invoiceStmt = db.prepare(`
          INSERT INTO invoices (user_id, amount, status, invoice_date, download_url)
          VALUES (?, ?, ?, ?, ?)
        `)

        invoiceStmt.run(
          decoded.id,
          invoice.amount,
          invoice.status,
          invoiceDate.toISOString(),
          `/api/billing/invoices/mock-${Date.now()}.pdf`,
        )
      }

      // Refetch invoices
      const updatedInvoices = db
        .prepare(`
        SELECT * FROM invoices 
        WHERE user_id = ? 
        ORDER BY invoice_date DESC 
        LIMIT 10
      `)
        .all(decoded.id)

      invoices.push(...updatedInvoices)
    }

    const billingInfo = {
      current_plan: billing.current_plan,
      billing_cycle: billing.billing_cycle,
      next_billing_date: billing.next_billing_date,
      amount: billing.amount,
      usage: {
        tests_generated: testsGenerated.count,
        tests_limit: currentPlanLimits.tests,
        team_members: teamMembers.count + 1, // +1 for the owner
        team_limit: currentPlanLimits.members,
        storage_used: Math.floor(Math.random() * currentPlanLimits.storage * 0.7), // Mock storage usage
        storage_limit: currentPlanLimits.storage,
      },
      payment_method: paymentMethod
        ? {
            type: paymentMethod.type,
            last_four: paymentMethod.last_four,
            expires: paymentMethod.expires,
          }
        : null,
      invoices: invoices.map((invoice: any) => ({
        id: invoice.id,
        date: invoice.invoice_date,
        amount: invoice.amount,
        status: invoice.status,
        download_url: invoice.download_url,
      })),
    }

    return NextResponse.json({
      billing: billingInfo,
    })
  } catch (error) {
    console.error("Billing fetch error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
