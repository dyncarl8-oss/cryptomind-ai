import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { type TradingPair, cryptoPairs, forexPairs } from "@shared/schema";
import { TrendingUp, DollarSign } from "lucide-react";

interface AppSidebarProps {
  onPairSelect: (pair: TradingPair) => void;
  selectedPair?: TradingPair;
}

export function AppSidebar({ onPairSelect, selectedPair }: AppSidebarProps) {
  return (
    <Sidebar data-testid="sidebar-trading-pairs">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Crypto Pairs
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {cryptoPairs.map((pair) => (
                <SidebarMenuItem key={pair}>
                  <SidebarMenuButton
                    onClick={() => onPairSelect(pair)}
                    isActive={selectedPair === pair}
                    data-testid={`button-crypto-${pair.toLowerCase().replace("/", "-")}`}
                  >
                    <span className="font-medium">{pair}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Forex Pairs
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {forexPairs.map((pair) => (
                <SidebarMenuItem key={pair}>
                  <SidebarMenuButton
                    onClick={() => onPairSelect(pair)}
                    isActive={selectedPair === pair}
                    data-testid={`button-forex-${pair.toLowerCase().replace("/", "-")}`}
                  >
                    <span className="font-medium">{pair}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
