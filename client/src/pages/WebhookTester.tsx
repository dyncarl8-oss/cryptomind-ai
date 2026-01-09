import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Webhook, Send, CheckCircle2, XCircle, Info } from "lucide-react";
import { Link } from "wouter";

export default function WebhookTester() {
  const { toast } = useToast();
  const [paymentId, setPaymentId] = useState(`pay_test_${Date.now()}`);
  // FIXED SUBSCRIPTION PRICE: $5.00 (commission: $2.50)
  const [amount] = useState("5.00");
  const [companyId, setCompanyId] = useState("biz_test_company");
  const [customerEmail, setCustomerEmail] = useState("test@example.com");
  const [customerUserId, setCustomerUserId] = useState("user_test_123");
  const [isLoading, setIsLoading] = useState(false);
  const [lastResponse, setLastResponse] = useState<string | null>(null);
  const [lastSuccess, setLastSuccess] = useState<boolean | null>(null);

  const generateNewPaymentId = () => {
    setPaymentId(`pay_test_${Date.now()}`);
  };

  const sendTestWebhook = async () => {
    setIsLoading(true);
    setLastResponse(null);
    setLastSuccess(null);

    try {
      const amountInCents = Math.round(parseFloat(amount) * 100);
      
      if (isNaN(amountInCents) || amountInCents <= 0) {
        throw new Error("Invalid amount");
      }

      const webhookPayload = {
        action: "payment.succeeded",
        type: "payment.succeeded",
        api_version: "v5",
        data: {
          id: paymentId,
          final_amount: amountInCents,
          subtotal: amountInCents,
          amount: amountInCents,
          company: {
            id: companyId,
            title: "Test Company",
            route: "test-company",
          },
          user: {
            id: customerUserId,
            email: customerEmail,
            username: customerEmail.split('@')[0],
          },
        },
      };

      console.log("Sending test webhook:", webhookPayload);

      const response = await fetch("/api/webhooks/payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(webhookPayload),
      });

      const responseText = await response.text();
      
      if (response.ok) {
        setLastSuccess(true);
        setLastResponse(`✅ Success! Commission should be added to admin balance.\n\nResponse: ${responseText}`);
        toast({
          title: "Webhook Sent Successfully!",
          description: `Test payment of $${amount} processed. Check admin balance.`,
        });
      } else {
        setLastSuccess(false);
        setLastResponse(`❌ Failed: ${response.status} ${response.statusText}\n\n${responseText}`);
        toast({
          title: "Webhook Failed",
          description: `Status: ${response.status}`,
          variant: "destructive",
        });
      }
    } catch (error) {
      setLastSuccess(false);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      setLastResponse(`❌ Error: ${errorMessage}`);
      toast({
        title: "Error Sending Webhook",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Webhook className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Webhook Tester</h1>
              <p className="text-muted-foreground">Test payment webhooks and see commissions in action</p>
            </div>
          </div>
          <Link href="/admin">
            <Button variant="outline" data-testid="button-back-admin">
              Back to Dashboard
            </Button>
          </Link>
        </div>

        {/* Info Alert */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            This tool sends test payment webhooks to simulate real customer payments. 
            <strong>Subscription is $5.00</strong> and commission is <strong>$2.50 (50%)</strong>. 
            Commissions will be <strong>actually added</strong> to admin balances and can be withdrawn.
          </AlertDescription>
        </Alert>

        {/* Test Webhook Form */}
        <Card>
          <CardHeader>
            <CardTitle>Send Test Payment</CardTitle>
            <CardDescription>
              Fill in the payment details below to simulate a real Whop payment webhook
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Payment ID */}
            <div className="space-y-2">
              <Label htmlFor="paymentId">Payment ID</Label>
              <div className="flex gap-2">
                <Input
                  id="paymentId"
                  data-testid="input-payment-id"
                  value={paymentId}
                  onChange={(e) => setPaymentId(e.target.value)}
                  placeholder="pay_test_123"
                />
                <Button
                  variant="outline"
                  onClick={generateNewPaymentId}
                  data-testid="button-generate-id"
                >
                  Generate New
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Must be unique. Already processed payments will be skipped (idempotency).
              </p>
            </div>

            {/* Company ID */}
            <div className="space-y-2">
              <Label htmlFor="companyId">Company ID</Label>
              <Input
                id="companyId"
                data-testid="input-company-id"
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                placeholder="biz_xxxxxxxxxxxxxx"
              />
              <p className="text-sm text-muted-foreground">
                The admin registered with this company ID will receive the commission.
              </p>
            </div>

            {/* Amount - FIXED */}
            <div className="space-y-2">
              <Label htmlFor="amount">Subscription Price (Fixed)</Label>
              <Input
                id="amount"
                data-testid="input-amount"
                type="text"
                value={`$${amount}`}
                disabled
                className="bg-muted"
              />
              <p className="text-sm text-muted-foreground">
                <strong>Fixed at $5.00</strong> - Commission (50%): <strong>$2.50</strong>
              </p>
            </div>

            {/* Customer Email */}
            <div className="space-y-2">
              <Label htmlFor="customerEmail">Customer Email</Label>
              <Input
                id="customerEmail"
                data-testid="input-customer-email"
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="customer@example.com"
              />
            </div>

            {/* Customer User ID */}
            <div className="space-y-2">
              <Label htmlFor="customerUserId">Customer User ID</Label>
              <Input
                id="customerUserId"
                data-testid="input-customer-id"
                value={customerUserId}
                onChange={(e) => setCustomerUserId(e.target.value)}
                placeholder="user_123"
              />
            </div>

            {/* Send Button */}
            <Button
              onClick={sendTestWebhook}
              disabled={isLoading}
              className="w-full"
              size="lg"
              data-testid="button-send-webhook"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-background mr-2" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send Test Webhook
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Response Display */}
        {lastResponse && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                {lastSuccess ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-destructive" />
                )}
                <CardTitle>
                  {lastSuccess ? "Webhook Sent Successfully" : "Webhook Failed"}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <Textarea
                value={lastResponse}
                readOnly
                className="font-mono text-sm min-h-[150px]"
                data-testid="text-response"
              />
              {lastSuccess && (
                <div className="mt-4">
                  <Link href="/admin">
                    <Button variant="outline" data-testid="button-check-balance">
                      Check Admin Balance
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* How It Works */}
        <Card>
          <CardHeader>
            <CardTitle>How This Works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3">
              <Badge variant="outline" className="mt-1">1</Badge>
              <p className="text-sm text-muted-foreground">
                This tool sends a webhook payload to <code className="bg-muted px-1 py-0.5 rounded">/api/webhooks/payment</code> 
                with the payment data you provide above.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="outline" className="mt-1">2</Badge>
              <p className="text-sm text-muted-foreground">
                The webhook endpoint calculates 50% commission and distributes it among all registered admins.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="outline" className="mt-1">3</Badge>
              <p className="text-sm text-muted-foreground">
                The commission is added to the admin balance and can be withdrawn to Whop account.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="outline" className="mt-1">4</Badge>
              <p className="text-sm text-muted-foreground">
                Real production webhooks from Whop work exactly the same way, but they're sent automatically when customers pay.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
