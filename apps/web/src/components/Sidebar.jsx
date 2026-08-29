'use me'
'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, MessageSquare, Package, ShoppingCart, Settings, BarChart2 } from 'lucide-react';

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/' },
  { label: 'Analytics', icon: BarChart2, href: '/analytics' },
  { label: 'Conversations', icon: MessageSquare, href: '/conversations' },
  { label: 'Products', icon: Package, href: '/products' },
  { label: 'Orders', icon: ShoppingCart, href: '/orders' },
  { label: 'Settings', icon: Settings, href: '/settings' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-dark-surface border-r border-dark-border p-6 flex flex-col justify-between hidden md:flex min-h-screen">
      <div>
        <div className="flex items-center gap-3 mb-8">
          <div className="w-8 h-8 rounded-lg bg-brand-PRIMARY flex items-center justify-center text-white font-bold">
            L
          </div>
          <span className="font-bold text-lg tracking-wide text-dark-text">LAYBOKA</span>
        </div>

        <nav className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-colors ${
                  isActive
                    ? 'bg-brand-PRIMARY text-white shadow-lg shadow-brand-PRIMARY/20'
                    : 'text-dark-muted hover:bg-dark-border/40 hover:text-dark-text'
                }`}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="p-4 rounded-xl bg-dark-bg/60 border border-dark-border/50 text-xs text-dark-muted">
        Shopify Sync Status: <span className="text-emerald-400 font-semibold">Active</span>
      </div>
    </aside>
  );
}
