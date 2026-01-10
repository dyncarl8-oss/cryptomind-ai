import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription
} from "@/components/ui/sheet";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SparklesIcon } from "@heroicons/react/24/outline";
import { MessageSquare, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Link } from "wouter";
import type { ChatSessionWithMessages } from "@shared/schema";

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

interface MemberSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: WhopUser | null | undefined;
  credits: UserCredits | undefined;
  onSessionSelect?: (sessionId: string) => void;
  onPurchase?: () => void;
  isPurchasing?: boolean;
  subscriptionManageUrl?: string | null;
}

export function MemberSidebar({ open, onOpenChange, user, credits, onSessionSelect, onPurchase, isPurchasing, subscriptionManageUrl }: MemberSidebarProps) {
  const initials = user?.name
    ? user.name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
    : "U";

  const { data: sessions = [], isLoading } = useQuery<ChatSessionWithMessages[]>({
    queryKey: ["/api/chat/sessions"],
    enabled: open,
  });

  const handleSessionClick = (sessionId: string) => {
    onSessionSelect?.(sessionId);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[300px] sm:w-[350px] flex flex-col p-0" data-testid="sidebar-member">
        <SheetHeader className="flex-shrink-0 px-6 pt-6 pb-4">
          <SheetTitle className="text-xl">History</SheetTitle>
          <SheetDescription>
            Your analysis sessions
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-4">
          {isLoading ? (
            <div className="text-sm text-muted-foreground text-center py-8">
              Loading...
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-12">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="font-medium">No history yet</p>
              <p className="text-xs mt-1 opacity-60">Start analyzing to build your history</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5 pb-4">
              {sessions.map((session) => {
                const displayTitle = session.tradingPair || "Chat Session";

                return (
                  <Button
                    key={session.id}
                    variant="ghost"
                    className="justify-start gap-3 h-auto py-3 px-3 hover-elevate"
                    onClick={() => handleSessionClick(session.id)}
                    data-testid={`sidebar-session-${session.id}`}
                  >
                    <div className="flex flex-col gap-1.5 flex-1 min-w-0 items-start">
                      <div className="flex items-center gap-2 w-full">
                        {session.tradingPair ? (
                          <>
                            <TrendingUp className="w-4 h-4 flex-shrink-0 text-primary" />
                            <span className="font-semibold text-sm truncate">
                              {session.tradingPair}
                            </span>
                            {session.timeframe && (
                              <Badge variant="secondary" className="text-xs ml-auto flex-shrink-0">
                                {session.timeframe}
                              </Badge>
                            )}
                          </>
                        ) : (
                          <>
                            <MessageSquare className="w-4 h-4 flex-shrink-0" />
                            <span className="font-medium text-sm truncate">{displayTitle}</span>
                          </>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(session.updatedAt), { addSuffix: true })}
                      </p>
                    </div>
                  </Button>
                );
              })}
            </div>
          )}
        </div>

        <Separator className="flex-shrink-0" />

        <div className="flex-shrink-0 px-6 py-4 space-y-3 pb-6">

          {credits && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border/50">
                <SparklesIcon className="w-5 h-5 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">
                    {credits.hasUnlimitedAccess ? "Unlimited" : `${credits.credits} Credits`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {credits.hasUnlimitedAccess ? "Pro access" : "Analyses remaining"}
                  </p>
                </div>
                {credits.hasUnlimitedAccess && (
                  <Badge variant="default" className="text-xs">Pro</Badge>
                )}
              </div>

              {!credits.hasUnlimitedAccess && onPurchase && (
                <Button
                  variant="default"
                  onClick={onPurchase}
                  disabled={isPurchasing}
                  className="w-full"
                  data-testid="button-get-unlimited-sidebar"
                >
                  {isPurchasing ? "Processing..." : "Get Unlimited"}
                </Button>
              )}

              {credits.hasUnlimitedAccess && subscriptionManageUrl && (
                <Button
                  variant="outline"
                  onClick={() => window.open(subscriptionManageUrl, '_blank')}
                  className="w-full"
                  data-testid="button-manage-subscription-sidebar"
                >
                  Manage Subscription
                </Button>
              )}
            </div>
          )}

          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10" data-testid="sidebar-avatar-user">
              {user?.profile_pic_url && (
                <AvatarImage
                  src={user.profile_pic_url}
                  alt={user.name || "User"}
                  crossOrigin="anonymous"
                />
              )}
              <AvatarFallback className="text-sm">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-0.5 flex-1 min-w-0">
              <p className="font-semibold text-sm truncate" data-testid="sidebar-text-username">
                {user?.name || "CryptoMind AI User"}
              </p>
              {user?.username && (
                <p className="text-xs text-muted-foreground truncate" data-testid="sidebar-text-handle">
                  @{user.username}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-2 opacity-60 hover:opacity-100 transition-opacity">
            <Link href="/terms">
              <a className="text-[9px] uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors font-medium">Terms</a>
            </Link>
            <Link href="/privacy">
              <a className="text-[9px] uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors font-medium">Privacy</a>
            </Link>
            <Link href="/risk">
              <a className="text-[9px] uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors font-medium">Risk Disclosure</a>
            </Link>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
