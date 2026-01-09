import { whopIframeSdk } from "./whop-iframe";

export async function purchaseCredits(): Promise<boolean> {
  // Send notification email when user clicks the button
  try {
    console.log("[Notification] Sending unlimited access clicked notification...");
    await fetch("/api/notifications/unlimited-access-clicked", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[Notification] Failed to send notification:", error);
    // Continue with purchase flow even if notification fails
  }

  if (!whopIframeSdk) {
    console.warn("Whop iframe SDK not available - simulating purchase in dev mode");
    
    try {
      const response = await fetch("/api/credits/purchase", {
        method: "POST",
        body: JSON.stringify({ success: true }),
        headers: { "Content-Type": "application/json" },
      });
      
      if (!response.ok) {
        throw new Error("Purchase request failed");
      }
      
      return true;
    } catch (error) {
      console.error("Error simulating purchase:", error);
      return false;
    }
  }

  try {
    console.log("[Payment] Creating checkout configuration...");
    
    const configResponse = await fetch("/api/credits/checkout-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    
    if (!configResponse.ok) {
      throw new Error("Failed to create checkout configuration");
    }
    
    const { checkoutConfigId, planId } = await configResponse.json();
    
    if (!checkoutConfigId || !planId) {
      console.error("Checkout configuration missing required data");
      return false;
    }

    console.log("[Payment] Opening payment modal with config:", { checkoutConfigId, planId });

    const result = await whopIframeSdk.inAppPurchase({
      planId: planId,
      id: checkoutConfigId,
    });

    if (result.status === "ok") {
      console.log("[Payment] Payment successful! Processing payment directly...");
      console.log("[Payment] Payment ID:", result.data.receiptId);
      
      // Process payment immediately without waiting for webhook
      try {
        const processResponse = await fetch("/api/credits/process-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentId: result.data.receiptId }),
        });

        if (!processResponse.ok) {
          const errorData = await processResponse.json();
          console.error("[Payment] Failed to process payment:", errorData);
          
          // If it's a client error (4xx), the payment itself may be invalid
          if (processResponse.status >= 400 && processResponse.status < 500) {
            console.error("[Payment] ❌ Payment processing failed:", errorData.error);
            return false;
          }
          
          // Server error (5xx) - payment was valid but processing failed
          console.error("[Payment] ❌ Server error processing payment:", errorData.error);
          return false;
        }

        const processData = await processResponse.json();
        console.log("[Payment] ✅ Payment processed:", processData);
        
        if (!processData.success) {
          console.error("[Payment] ❌ Payment processing returned success: false");
          return false;
        }
        
        if (processData.accessGranted) {
          console.log("[Payment] ✅ Unlimited access granted!");
        } else {
          console.warn("[Payment] ⚠️  Access was not granted");
        }
        
        if (processData.commissionRecorded) {
          console.log("[Payment] ✅ Admin commission recorded!");
        } else {
          console.log("[Payment] ℹ️  No commission recorded (no admin found)");
        }
        
        return processData.accessGranted;
      } catch (error) {
        console.error("[Payment] Error processing payment:", error);
        // Network error or unexpected error
        console.error("[Payment] ❌ Failed to process payment due to network error");
        return false;
      }
    } else {
      console.log("[Payment] Payment was not completed:", result.error);
      return false;
    }
  } catch (error) {
    console.error("[Payment] Error during payment:", error);
    return false;
  }
}
