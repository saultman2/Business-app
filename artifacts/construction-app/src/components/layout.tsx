import React, { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { UserButton, useUser } from "@clerk/react";
import {
  HardHat,
  Users,
  Calendar,
  Menu,
  X,
  Zap,
  Sparkles,
  Wallet,
  UsersRound,
  LogOut,
  Home,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGetCompany } from "@workspace/api-client-react";
import { useClerk } from "@clerk/react";

const logoSrc = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/logo.svg`;

const nav = [
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/quotes", label: "Quick Quote", icon: Zap },
  { href: "/jobs", label: "Projects", icon: HardHat },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/crew", label: "Crew", icon: UsersRound },
  { href: "/finances", label: "Finances", icon: Wallet },
  { href: "/ai-tools", label: "AI Tools", icon: Sparkles },
];

// 5 most common actions for the mobile bottom-tab bar
const bottomNav = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/quotes", label: "Quote", icon: Zap },
  { href: "/jobs", label: "Projects", icon: HardHat },
  { href: "/finances", label: "Finances", icon: Wallet },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user } = useUser();
  const { data: company } = useGetCompany();
  const { signOut } = useClerk();

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location]);

  const displayName = company?.name || user?.fullName || user?.username || "My Business";
  const phone = company?.phone || user?.primaryPhoneNumber?.phoneNumber || "";

  const isActive = (href: string) =>
    location === href || location.startsWith(`${href}/`);

  const NavLink = ({ item }: { item: { href: string; label: string; icon: typeof Users } }) => {
    const active = isActive(item.href);
    return (
      <Link href={item.href}>
        <div
          className={`
            flex items-center gap-3 px-3 min-h-11 rounded-lg text-sm font-medium transition-all cursor-pointer
            ${active
              ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
              : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            }
          `}
        >
          <item.icon className="h-[18px] w-[18px] shrink-0" />
          {item.label}
        </div>
      </Link>
    );
  };

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row bg-background">
      {/* Mobile header */}
      <header className="md:hidden flex items-center justify-between h-14 px-4 bg-sidebar border-b border-sidebar-border sticky top-0 z-50">
        <Link href="/dashboard">
          <div className="flex items-center gap-2 cursor-pointer">
            <img src={logoSrc} alt="BuildPro" className="w-7 h-7" />
            <span className="font-bold text-base text-white">BuildPro</span>
          </div>
        </Link>
        <div className="flex items-center gap-3">
          <UserButton />
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/10 h-11 w-11"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </header>

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-40 w-60 bg-sidebar transform transition-transform duration-200 ease-in-out flex flex-col
          md:relative md:translate-x-0
          ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <Link href="/dashboard">
          <div className="hidden md:flex items-center gap-2.5 h-16 px-5 border-b border-sidebar-border cursor-pointer">
            <div className="w-9 h-9 bg-sidebar-primary rounded-lg flex items-center justify-center shrink-0">
              <img src={logoSrc} alt="BuildPro" className="w-5 h-5" />
            </div>
            <div>
              <div className="text-white font-bold text-base leading-tight tracking-tight">BuildPro</div>
              <div className="text-sidebar-foreground/60 text-xs leading-tight">Contractor OS</div>
            </div>
          </div>
        </Link>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {nav.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
        </nav>

        <Link href="/settings">
          <div className="px-3 py-4 border-t border-sidebar-border cursor-pointer hover:bg-sidebar-accent/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground text-sm font-bold shrink-0">
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-white text-sm font-semibold truncate">{displayName}</div>
                {phone && <div className="text-sidebar-foreground/60 text-xs truncate">{phone}</div>}
              </div>
            </div>
          </div>
        </Link>
        <div className="px-3 pb-4">
          <button
            onClick={() => signOut()}
            className="flex items-center gap-2 text-sidebar-foreground hover:text-white text-sm w-full min-h-11 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Log Out
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 pb-20 md:pb-0 overflow-y-auto">
        <div className="flex-1 w-full max-w-7xl mx-auto">{children}</div>
      </main>

      {/* Mobile bottom-tab bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-sidebar border-t border-sidebar-border flex items-stretch h-16">
        {bottomNav.map((item) => {
          const active = isActive(item.href);
          return (
            <Link key={item.href} href={item.href} className="flex-1">
              <div className={`flex flex-col items-center justify-center gap-1 h-full transition-colors ${
                active ? "text-sidebar-primary" : "text-sidebar-foreground"
              }`}>
                <item.icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </div>
  );
}
