import React, { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { UserButton, useUser } from "@clerk/react";
import {
  LayoutDashboard,
  HardHat,
  FileText,
  Users,
  Calendar,
  Settings,
  Menu,
  X,
  Receipt,
  Sparkles,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGetCompany } from "@workspace/api-client-react";
import { useClerk } from "@clerk/react";

const navItems = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/jobs", label: "Projects", icon: HardHat },
  { href: "/quotes", label: "Quotes", icon: FileText },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/settings", label: "Business Info", icon: Settings },
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

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row bg-[#f0f2f5]">
      <header className="md:hidden flex items-center justify-between h-14 px-4 bg-[#1a2340] border-b border-[#2a3450] sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <img src={`${import.meta.env.BASE_URL.replace(/\/$/, "")}/logo.svg`} alt="BuildPro" className="w-7 h-7" />
          <span className="font-bold text-base text-white">BuildPro</span>
        </div>
        <div className="flex items-center gap-3">
          <UserButton />
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </header>

      <aside className={`
        fixed inset-y-0 left-0 z-40 w-56 bg-[#1a2340] transform transition-transform duration-200 ease-in-out flex flex-col
        md:relative md:translate-x-0
        ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}
      `}>
        <div className="hidden md:flex items-center gap-2.5 h-14 px-5 border-b border-[#2a3450]">
          <div className="w-7 h-7 bg-[#2563eb] rounded flex items-center justify-center shrink-0">
            <img src={`${import.meta.env.BASE_URL.replace(/\/$/, "")}/logo.svg`} alt="BuildPro" className="w-5 h-5" />
          </div>
          <div>
            <div className="text-white font-bold text-sm leading-tight">BuildPro</div>
            <div className="text-[#6b7fa3] text-xs leading-tight">Cost Estimator</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {navItems.map((item) => {
            const isActive = location === item.href || location.startsWith(`${item.href}/`);
            return (
              <Link key={item.href} href={item.href}>
                <div className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all cursor-pointer
                  ${isActive
                    ? "bg-[#2563eb] text-white"
                    : "text-[#8a9bc4] hover:bg-[#243056] hover:text-white"
                  }
                `}>
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-[#2a3450]">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-[#2563eb] flex items-center justify-center text-white text-sm font-bold shrink-0">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-white text-sm font-medium truncate">{displayName}</div>
              {phone && <div className="text-[#6b7fa3] text-xs truncate">{phone}</div>}
            </div>
          </div>
          <button
            onClick={() => signOut()}
            className="flex items-center gap-2 text-[#8a9bc4] hover:text-white text-sm w-full transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Log Out
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0 overflow-y-auto">
        <div className="flex-1 w-full max-w-7xl mx-auto">
          {children}
        </div>
      </main>

      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </div>
  );
}
