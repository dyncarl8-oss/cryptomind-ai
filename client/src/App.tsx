import { Switch, Route, useLocation, useParams } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import Chat from "@/pages/Chat";
import AdminDashboard from "@/pages/AdminDashboard";
import WebhookTester from "@/pages/WebhookTester";
import { whopIframeSdk } from "./lib/whop-iframe";
import { useEffect, useState } from "react";

function AdminRedirect() {
  const [, setLocation] = useLocation();
  const [resourceId, setResourceId] = useState<string | null>(null);

  // Extract experienceId or companyId from URL hash/query params that Whop might pass
  useEffect(() => {
    // Check URL hash for resource ID (Whop iframe context)
    const hash = window.location.hash;
    const searchParams = new URLSearchParams(window.location.search);

    // Try to extract from query params or hash
    const experienceId = searchParams.get('experienceId') || searchParams.get('experience_id');
    const companyId = searchParams.get('companyId') || searchParams.get('company_id');

    if (experienceId) {
      console.log("[AdminRedirect] Found experienceId in URL:", experienceId);
      setResourceId(experienceId);
    } else if (companyId) {
      console.log("[AdminRedirect] Found companyId in URL:", companyId);
      setResourceId(companyId);
    } else {
      console.log("[AdminRedirect] No resource ID found in URL");
      setResourceId('default');
    }
  }, []);

  const { data: adminCheck, isLoading, error } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["/api/admin/check", resourceId],
    enabled: resourceId !== null,
    queryFn: async () => {
      const response = await fetch("/api/admin/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ resourceId }),
      });
      if (!response.ok) throw new Error("Failed to check admin status");
      return response.json();
    },
    retry: 1,
  });

  useEffect(() => {
    if (!isLoading && adminCheck) {
      console.log("[AdminRedirect] Admin check result:", adminCheck);
      if (adminCheck.isAdmin) {
        console.log("[AdminRedirect] Redirecting to /admin");
        setLocation("/admin");
      } else {
        console.log("[AdminRedirect] Redirecting to /chat");
        setLocation("/chat");
      }
    }
  }, [adminCheck, isLoading, setLocation]);

  useEffect(() => {
    if (error) {
      console.error("[AdminRedirect] Error during admin check:", error);
      console.log("[AdminRedirect] Defaulting to /chat due to error");
      setLocation("/chat");
    }
  }, [error, setLocation]);

  if (isLoading || resourceId === null) {
    return (
      <div className="flex items-center justify-center h-screen w-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">Checking access...</p>
        </div>
      </div>
    );
  }

  return null;
}

function ExperienceRoute() {
  const [, setLocation] = useLocation();
  const params = useParams<{ experienceId: string }>();
  const experienceId = params.experienceId;

  console.log("[ExperienceRoute] Experience ID from URL:", experienceId);

  const { data: adminCheck, isLoading, error } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["/api/admin/check", experienceId],
    queryFn: async () => {
      console.log("[ExperienceRoute] Checking admin status for experienceId:", experienceId);
      const response = await fetch("/api/admin/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ resourceId: experienceId }),
      });
      if (!response.ok) throw new Error("Failed to check admin status");
      return response.json();
    },
    retry: 1,
  });

  useEffect(() => {
    if (!isLoading && adminCheck) {
      console.log("[ExperienceRoute] Admin check result:", adminCheck);
      if (adminCheck.isAdmin) {
        console.log("[ExperienceRoute] Admin detected, redirecting to /admin");
        setLocation("/admin");
      } else {
        console.log("[ExperienceRoute] Non-admin user, showing chat");
      }
    }
  }, [adminCheck, isLoading, setLocation]);

  useEffect(() => {
    if (error) {
      console.error("[ExperienceRoute] Error during admin check:", error);
      console.log("[ExperienceRoute] Defaulting to chat due to error");
    }
  }, [error]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen w-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">Checking access...</p>
        </div>
      </div>
    );
  }

  return <Chat />;
}

import Terms from "@/pages/Terms";
import Privacy from "@/pages/Privacy";
import RiskDisclosure from "@/pages/RiskDisclosure";

function Router() {
  return (
    <Switch>
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/webhook-tester" component={WebhookTester} />
      <Route path="/experiences/:experienceId" component={ExperienceRoute} />
      <Route path="/terms" component={Terms} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/risk" component={RiskDisclosure} />
      <Route path="/" component={Chat} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <div className="flex h-screen w-full">
            <Router />
          </div>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export { whopIframeSdk };

export default App;
