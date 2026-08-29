import React from 'react';
import { LayoutDashboard, MessageSquare, Package, ShoppingCart, Settings, BarChart2 } from 'lucide-react';
import './globals.css';

export const metadata = {
  title: 'Merchant Dashboard',
  description: 'AI & Shopify Management Portal',
};

export default function RootLayout({ children }) {
  const navItems = [
    { label: 'Dashboard', icon: LayoutDashboard, active: true },
    { label: 'Analytics', icon: BarChart2 },
    { label: 'Conversations', icon: MessageSquare },
    { label: 'Products', icon: Package },
    { label: 'Orders', icon: ShoppingCart },
    { label: 'Settings', icon: Settings },
  ];

  return (
    <html lang="en">
      <body className="bg-dark-bg text-dark-text min-h-screen flex antialiased">
        {/* Sidebar */}
        <aside className="w-64 bg-dark-surface border-r border-dark-border p-6 flex flex-col justify-between hidden md:flex">
          <div>
            <div className="flex items-center gap-3 mb-8">
              <div className="w-8 h-8 rounded-lg bg-brand-PRIMARY flex items-center justify-center text-white font-bold">
                L
              </div>
              <span className="font-bold text-lg tracking-wide">LAYBOKA</span>
            </div>

            <nav className="space-y-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.label}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-colors ${
                      item.active
                        ? 'bg-brand-PRIMARY text-white shadow-lg shadow-brand-PRIMARY/20'
                        : 'text-dark-muted hover:bg-dark-border/40 hover:text-dark-text'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="p-4 rounded-xl bg-dark-bg/60 border border-dark-border/50 text-xs text-dark-muted">
            Shopify Sync Status: <span className="text-emerald-400 font-semibold">Active</span>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col overflow-y-auto">
          {/* Header */}
          <header className="h-16 border-b border-dark-border px-8 flex items-center justify-between bg-dark-surface/50 backdrop-blur-md sticky top-0 z-10">
            <h1 className="font-semibold text-lg text-dark-text">Overview</h1>
            <div className="flex items-center gap-4">
              <button className="px-4 py-2 bg-brand-PRIMARY hover:bg-brand-hover text-white text-sm font-medium rounded-lg transition-colors">
                + Connect Store
              </button>
            </div>
          </header>

          {/* Page Body */}
          <div className="p-8">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
