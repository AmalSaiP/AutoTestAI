import { type NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/auth"
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

    const { plan } = await request.json()

    if (!plan || !["free", "basic", "pro", "enterprise"].includes(plan.toLowerCase())) {
      return NextResponse.json({ error: "Valid plan is required" }, { status: 400 })
    }

    const planPricing = {
      free: 0,
      basic: 29,
      pro: 99,
      enterprise: 299,
    }

    const db = getDatabase()

    // Update user plan
    const userStmt = db.prepare("UPDATE users SET plan = ?, updated_at = datetime('now') WHERE id = ?")
    userStmt.run(plan.toLowerCase(), decoded.id)

    // Update billing info
    const nextBillingDate = new Date()
    nextBillingDate.setMonth(nextBillingDate.getMonth() + 1)

    const billingStmt = db.prepare(`
      UPDATE user_billing 
      SET current_plan = ?, amount = ?, next_billing_date = ?, updated_at = datetime('now')
      WHERE user_id = ?
    `)

    billingStmt.run(
      plan.toLowerCase(),
      planPricing[plan.toLowerCase() as keyof typeof planPricing],
      nextBillingDate.toISOString(),
      decoded.id,
    )

    // Create a mock payment method if upgrading to paid plan
    if (plan.toLowerCase() !== "free") {
      const existingPaymentMethod = db.prepare("SELECT * FROM payment_methods WHERE user_id = ?").get(decoded.id)

      if (!existingPaymentMethod) {
        const paymentStmt = db.prepare(`
          INSERT INTO payment_methods (user_id, type, last_four, expires)
          VALUES (?, ?, ?, ?)
        `)

        const mockExpiry = new Date()
        mockExpiry.setFullYear(mockExpiry.getFullYear() + 3)

        paymentStmt.run(decoded.id, "card", "4242", mockExpiry.toISOString().substring(0, 7)) // YYYY-MM format
      }

      // For paid plans, simulate Stripe checkout (in real app, create Stripe session)
      if (plan.toLowerCase() !== "free") {
        return NextResponse.json({
          checkout_url: `https://checkout.stripe.com/pay/mock-session-${generateId()}`,
          message: "Redirecting to payment...",
        })
      }
    }

    return NextResponse.json({
      message: `Successfully upgraded to ${plan} plan`,
      plan: plan.toLowerCase(),
      amount: planPricing[plan.toLowerCase() as keyof typeof planPricing],
    })
  } catch (error) {
    console.error("Plan upgrade error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
