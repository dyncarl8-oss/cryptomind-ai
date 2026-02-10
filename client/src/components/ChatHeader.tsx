import { ArrowPathIcon, SparklesIcon } from "@heroicons/react/24/outline";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { purchaseCredits } from "@/lib/whop-payment";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link, useParams } from "wouter";
import { ThemeToggle } from "./ThemeToggle";
import { Menu } from "lucide-react";
import { useState } from "react";
import { MemberSidebar } from "./MemberSidebar";

interface ChatHeaderProps {
  onNewSession: () => void;
  onSessionSelect?: (sessionId: string) => void;
}

interface WhopUser {
  id: string;
  username: string;
  name: string;
  profile_pic_url?: string | null;
  companyId?: string;
  experienceId?: string;
}

interface UserCredits {
  userId: string;
  credits: number;
  hasUnlimitedAccess: boolean;
}

export function ChatHeader({ onNewSession, onSessionSelect }: ChatHeaderProps) {
  const { toast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { data: user } = useQuery<WhopUser | null>({
    queryKey: ["/api/auth/me"],
  });

  const { data: credits, isLoading: creditsLoading } = useQuery<UserCredits>({
    queryKey: ["/api/credits"],
  });

  const { data: subscriptionData } = useQuery<{ manageUrl: string; status: string } | null>({
    queryKey: ["/api/subscription/manage-url"],
    enabled: credits?.hasUnlimitedAccess === true,
    retry: false,
  });

  const { data: adminCheck } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["/api/admin/check", user?.companyId, user?.experienceId],
    queryFn: async () => {
      const resourceId = user?.companyId || user?.experienceId;
      if (!resourceId) {
        return { isAdmin: false };
      }
      const response = await fetch("/api/admin/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ resourceId }),
      });
      if (!response.ok) return { isAdmin: false };
      return response.json();
    },
    retry: false,
    enabled: !!user && (!!user.companyId || !!user.experienceId),
  });

  const params = useParams<{ experienceId?: string }>();
  const experienceId = params.experienceId;

  const purchaseMutation = useMutation({
    mutationFn: async () => {
      const success = await purchaseCredits({
        experienceId: experienceId || user?.experienceId,
        companyId: user?.companyId
      });
      if (!success) {
        throw new Error("Purchase failed");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/credits"] });
      toast({
        title: "Welcome to Unlimited Access!",
        description: "You now have unlimited AI predictions. Analyze as many pairs as you want!",
      });
    },
    onError: () => {
      toast({
        title: "Purchase failed",
        description: "There was an error processing your purchase. Please try again.",
        variant: "destructive",
      });
    },
  });

  const initials = user?.name
    ? user.name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
    : "U";

  return (
    <>
      <MemberSidebar
        open={sidebarOpen}
        onOpenChange={setSidebarOpen}
        user={user}
        credits={credits}
        onSessionSelect={onSessionSelect}
        onPurchase={() => purchaseMutation.mutate()}
        isPurchasing={purchaseMutation.isPending}
        subscriptionManageUrl={subscriptionData?.manageUrl}
      />
      <div className="flex items-center justify-between gap-2 md:gap-4 lg:gap-6 px-3 md:px-6 lg:px-12 xl:px-24 py-3 md:py-4 w-full backdrop-blur-md" data-testid="chat-header">
        <div className="flex items-center gap-2 md:gap-3 lg:gap-4 flex-1 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
            className="flex-shrink-0"
            data-testid="button-menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <Avatar className="h-8 w-8 md:h-9 md:w-9 lg:h-10 lg:w-10 flex-shrink-0" data-testid="avatar-user">
            {user?.profile_pic_url && (
              <AvatarImage
                src={user.profile_pic_url}
                alt={user.name || "User"}
                crossOrigin="anonymous"
                onError={(e) => {
                  console.error("[Avatar] Failed to load profile picture:", user.profile_pic_url);
                }}
              />
            )}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col min-w-0 flex-1">
            <h2 className="text-xs md:text-base font-semibold truncate" data-testid="text-username">
              {user?.name || "CryptoMind AI"}
            </h2>
            {user?.username && (
              <p className="text-xs text-muted-foreground truncate hidden sm:block" data-testid="text-handle">
                @{user.username}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 md:gap-2 lg:gap-3 flex-shrink-0 flex-wrap justify-end">
          {adminCheck?.isAdmin && (
            <Link href="/admin">
              <Button
                variant="outline"
                size="sm"
                className="text-xs whitespace-nowrap px-2 md:px-3"
                data-testid="button-admin-dashboard"
              >
                <span className="hidden sm:inline">Admin Dashboard</span>
                <span className="sm:hidden">Admin</span>
              </Button>
            </Link>
          )}
          <ThemeToggle />
          {!creditsLoading && credits && (
            <div className="flex items-center gap-1 md:gap-2">
              <Badge variant="secondary" className="text-xs px-2" data-testid="badge-credits">
                <SparklesIcon className="w-3 h-3 mr-1" />
                <span className="hidden xs:inline">{credits.hasUnlimitedAccess ? "∞ credits" : `${credits.credits} credits`}</span>
                <span className="xs:hidden">{credits.hasUnlimitedAccess ? "∞" : credits.credits}</span>
              </Badge>
              {!credits.hasUnlimitedAccess && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => purchaseMutation.mutate()}
                  disabled={purchaseMutation.isPending}
                  className="text-xs whitespace-nowrap px-2 md:px-3"
                  data-testid="button-get-unlimited-header"
                >
                  <span className="hidden sm:inline">{purchaseMutation.isPending ? "Processing..." : "Get Unlimited"}</span>
                  <span className="sm:hidden">{purchaseMutation.isPending ? "..." : "Unlimited"}</span>
                </Button>
              )}
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onNewSession}
            className="gap-1 md:gap-2 px-2 md:px-3"
            data-testid="button-new-session"
          >
            <ArrowPathIcon className="w-3 h-3 md:w-4 md:h-4" />
            <span className="hidden sm:inline text-xs md:text-sm">New Session</span>
          </Button>
        </div>
      </div>
    </>
  );
}
