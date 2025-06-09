"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Navigation } from "@/components/navigation"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/components/auth-provider"
import { CreditCard, Check, Crown, Download, Calendar, AlertCircle } from "lucide-react"

interface BillingInfo {
  current_plan: string
  billing_cycle: "monthly" | "yearly"
  next_billing_date: string
  amount: number
  usage: {
    tests_generated: number
    tests_limit: number
    team_members: number
    team_limit: number
    storage_used: number
    storage_limit: number
  }
  payment_method: {
    type: string
    last_four: string
    expires: string
  }
  invoices: Array<{
    id: string
    date: string
    amount: number
    status: string
    download_url: string
  }>
}

const plans = [
  {
    name: "Free",
    price: 0,
    billing: "forever",
    features: ["500 tests per month", "1 team member", "Basic test types", "Email support", "7-day history"],
    limits: {
      tests: 500,
      members: 1,
      storage: "1GB",
    },
  },
  {
    name: "Basic",
    price: 29,
    billing: "per month",
    features: [
      "5,000 tests per month",
      "5 team members",
      "All test types",
      "Priority support",
      "30-day history",
      "Basic integrations",
    ],
    limits: {
      tests: 5000,
      members: 5,
      storage: "10GB",
    },
  },
  {
    name: "Pro",
    price: 99,
    billing: "per month",
    popular: true,
    features: [
      "25,000 tests per month",
      "15 team members",
      "All test types",
      "24/7 support",
      "90-day history",
      "All integrations",
      "Custom reports",
      "API access",
    ],
    limits: {
      tests: 25000,
      members: 15,
      storage: "100GB",
    },
  },
  {
    name: "Enterprise",
    price: 299,
    billing: "per month",
    features: [
      "Unlimited tests",
      "Unlimited team members",
      "All test types",
      "Dedicated support",
      "Unlimited history",
      "All integrations",
      "Custom reports",
      "API access",
      "SSO",
      "Custom branding",
    ],
    limits: {
      tests: "Unlimited",
      members: "Unlimited",
      storage: "Unlimited",
    },
  },
]

export default function BillingPage() {
  const { user } = useAuth()
  const [billingInfo, setBillingInfo] = useState<BillingInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [upgrading, setUpgrading] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetchBillingInfo()
  }, [])

  const fetchBillingInfo = async () => {
    try {
      const token = localStorage.getItem("token")
      const response = await fetch("/api/billing", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setBillingInfo(data.billing)
      }
    } catch (error) {
      console.error("Failed to fetch billing info:", error)
    } finally {
      setLoading(false)
    }
  }

  const upgradePlan = async (planName: string) => {
    setUpgrading(true)
    try {
      const token = localStorage.getItem("token")
      const response = await fetch("/api/billing/upgrade", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan: planName }),
      })

      if (response.ok) {
        const data = await response.json()
        if (data.checkout_url) {
          window.location.href = data.checkout_url
        } else {
          toast({
            title: "Plan Upgraded",
            description: `Successfully upgraded to ${planName} plan`,
          })
          fetchBillingInfo()
        }
      } else {
        toast({
          title: "Upgrade Failed",
          description: "Failed to upgrade plan",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Plan upgrade error:", error)
      toast({
        title: "Error",
        description: "An error occurred during plan upgrade",
        variant: "destructive",
      })
    } finally {
      setUpgrading(false)
    }
  }

  const downloadInvoice = (invoiceUrl: string, invoiceId: string) => {
    const link = document.createElement("a")
    link.href = invoiceUrl
    link.download = `invoice-${invoiceId}.pdf`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading billing information...</p>
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
          <h1 className="text-3xl font-bold text-gray-900">Billing & Subscription</h1>
          <p className="text-gray-600 mt-2">Manage your subscription and billing information</p>
        </div>

        {/* Current Plan & Usage */}
        {billingInfo && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Crown className="w-5 h-5" />
                  <span>Current Plan</span>
                </CardTitle>
                <CardDescription>Your current subscription and usage</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-bold capitalize">{billingInfo.current_plan} Plan</h3>
                    <p className="text-gray-500">
                      ${billingInfo.amount}/{billingInfo.billing_cycle}
                    </p>
                  </div>
                  <Badge variant="default" className="text-lg px-3 py-1">
                    Active
                  </Badge>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Tests Generated</span>
                      <span>
                        {billingInfo.usage.tests_generated} / {billingInfo.usage.tests_limit}
                      </span>
                    </div>
                    <Progress
                      value={(billingInfo.usage.tests_generated / billingInfo.usage.tests_limit) * 100}
                      className="h-2"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Team Members</span>
                      <span>
                        {billingInfo.usage.team_members} / {billingInfo.usage.team_limit}
                      </span>
                    </div>
                    <Progress
                      value={(billingInfo.usage.team_members / billingInfo.usage.team_limit) * 100}
                      className="h-2"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Storage Used</span>
                      <span>
                        {billingInfo.usage.storage_used}GB / {billingInfo.usage.storage_limit}GB
                      </span>
                    </div>
                    <Progress
                      value={(billingInfo.usage.storage_used / billingInfo.usage.storage_limit) * 100}
                      className="h-2"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <p className="text-sm text-gray-600">
                    Next billing date: {new Date(billingInfo.next_billing_date).toLocaleDateString()}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <CreditCard className="w-5 h-5" />
                  <span>Payment Method</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {billingInfo.payment_method ? (
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-6 bg-gray-200 rounded flex items-center justify-center">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-medium">•••• {billingInfo.payment_method.last_four}</p>
                      <p className="text-sm text-gray-500">Expires {billingInfo.payment_method.expires}</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <AlertCircle className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">No payment method on file</p>
                  </div>
                )}

                <Button variant="outline" className="w-full">
                  Update Payment Method
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Pricing Plans */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Choose Your Plan</CardTitle>
            <CardDescription>Upgrade or downgrade your subscription at any time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {plans.map((plan) => (
                <div
                  key={plan.name}
                  className={`relative p-6 border rounded-lg ${
                    plan.popular ? "border-blue-500 shadow-lg" : "border-gray-200"
                  } ${
                    billingInfo?.current_plan.toLowerCase() === plan.name.toLowerCase()
                      ? "bg-blue-50 border-blue-500"
                      : "bg-white"
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <Badge className="bg-blue-500">Most Popular</Badge>
                    </div>
                  )}

                  <div className="text-center mb-6">
                    <h3 className="text-xl font-bold">{plan.name}</h3>
                    <div className="mt-2">
                      <span className="text-3xl font-bold">${plan.price}</span>
                      <span className="text-gray-500">/{plan.billing}</span>
                    </div>
                  </div>

                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-center space-x-2">
                        <Check className="w-4 h-4 text-green-500" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="space-y-2 mb-6 text-sm text-gray-600">
                    <div className="flex justify-between">
                      <span>Tests:</span>
                      <span>{plan.limits.tests}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Members:</span>
                      <span>{plan.limits.members}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Storage:</span>
                      <span>{plan.limits.storage}</span>
                    </div>
                  </div>

                  <Button
                    className="w-full"
                    variant={
                      billingInfo?.current_plan.toLowerCase() === plan.name.toLowerCase()
                        ? "outline"
                        : plan.popular
                          ? "default"
                          : "outline"
                    }
                    disabled={billingInfo?.current_plan.toLowerCase() === plan.name.toLowerCase() || upgrading}
                    onClick={() => upgradePlan(plan.name)}
                  >
                    {billingInfo?.current_plan.toLowerCase() === plan.name.toLowerCase()
                      ? "Current Plan"
                      : upgrading
                        ? "Processing..."
                        : `Upgrade to ${plan.name}`}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Billing History */}
        {billingInfo && billingInfo.invoices.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Calendar className="w-5 h-5" />
                <span>Billing History</span>
              </CardTitle>
              <CardDescription>Download your invoices and payment history</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4">Date</th>
                      <th className="text-left py-3 px-4">Amount</th>
                      <th className="text-left py-3 px-4">Status</th>
                      <th className="text-left py-3 px-4">Invoice</th>
                    </tr>
                  </thead>
                  <tbody>
                    {billingInfo.invoices.map((invoice) => (
                      <tr key={invoice.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4">{new Date(invoice.date).toLocaleDateString()}</td>
                        <td className="py-3 px-4 font-medium">${invoice.amount}</td>
                        <td className="py-3 px-4">
                          <Badge variant={invoice.status === "paid" ? "default" : "destructive"}>
                            {invoice.status.toUpperCase()}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => downloadInvoice(invoice.download_url, invoice.id)}
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Download
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
