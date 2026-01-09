import { useState, useEffect } from "react";
import { whopIframeSdk } from "@/lib/whop-iframe";

interface WhopAuthState {
  isLoading: boolean;
  hasAccess: boolean;
  accessLevel?: "customer" | "admin";
  error?: string;
  userId?: string;
}

export function useWhopAuth(experienceId?: string): WhopAuthState {
  const [state, setState] = useState<WhopAuthState>({
    isLoading: true,
    hasAccess: false,
  });

  useEffect(() => {
    async function checkAccess() {
      console.log("[useWhopAuth] Checking access for experienceId:", experienceId);
      
      if (!experienceId) {
        console.log("[useWhopAuth] No experienceId provided, granting access");
        setState({
          isLoading: false,
          hasAccess: true,
        });
        return;
      }

      try {
        setState({ isLoading: true, hasAccess: false });

        console.log("[useWhopAuth] Making request to /api/auth/check-access");
        const response = await fetch("/api/auth/check-access", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({ experienceId }),
        });

        console.log("[useWhopAuth] Response status:", response.status);

        if (!response.ok) {
          const data = await response.json();
          console.error("[useWhopAuth] Access denied:", data);
          setState({
            isLoading: false,
            hasAccess: false,
            error: data.error || "Access denied",
          });
          return;
        }

        const data = await response.json();
        console.log("[useWhopAuth] Access granted:", data);
        setState({
          isLoading: false,
          hasAccess: data.hasAccess,
          accessLevel: data.accessLevel,
        });
      } catch (error) {
        console.error("[useWhopAuth] Error checking Whop access:", error);
        console.log("[useWhopAuth] Falling back to allowing access");
        setState({
          isLoading: false,
          hasAccess: true,
          accessLevel: "customer",
        });
      }
    }

    checkAccess();
  }, [experienceId]);

  return state;
}
