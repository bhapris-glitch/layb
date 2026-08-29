import React from 'react';
import Sidebar from '../components/Sidebar';
import './globals.css';

export const metadata = {
  title: 'Layboka Merchant Platform',
  description: 'AI-Powered Shopify Merchant Portal',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-dark-bg text-dark-text min-h-screen flex antialiased">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-y-auto">
          <header className="h-16 border-b border-dark-border px-8 flex items-center justify-between bg-dark-surface/50 backdrop-blur-md sticky top-0 z-10">
            <h1 className="font-semibold text-lg text-dark-text">Merchant Workspace</h1>
            <div className="flex items-center gap-4">
              <button className="px-4 py-2 bg-brand-PRIMARY hover:bg-brand-hover text-white text-sm font-medium rounded-lg transition-colors">
                + Connect Store
              </button>
            </div>
          </header>
          <div className="p-8">{children}</div>
        </main>
      </body>
    </html>
  );
}
