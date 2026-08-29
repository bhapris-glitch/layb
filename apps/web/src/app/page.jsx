import React from 'react';
import { TrendingUp, Users, MessageCircle, ShoppingBag } from 'lucide-react';

export default function DashboardPage() {
  const stats = [
    { title: 'Total Revenue', value: '$24,500.00', change: '+12.5%', icon: TrendingUp },
    { title: 'Active Conversations', value: '1,429', change: '+8.2%', icon: MessageCircle },
    { title: 'Total Customers', value: '894', change: '+5.1%', icon: Users },
    { title: 'AI Conversions', value: '312', change: '+18.4%', icon: ShoppingBag },
  ];

  return (
    <div className="space-y-8">
      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div key={idx} className="bg-dark-surface border border-dark-border p-6 rounded-2xl flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs text-dark-muted uppercase font-semibold tracking-wider">{stat.title}</p>
                  <h3 className="text-2xl font-bold mt-2 text-dark-text">{stat.value}</h3>
                </div>
                <div className="p-3 bg-dark-bg rounded-xl border border-dark-border text-brand-PRIMARY">
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <span className="text-xs font-semibold text-emerald-400 mt-4 inline-block">{stat.change} vs last month</span>
            </div>
          );
        })}
      </div>

      {/* Analytics & Activity Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-dark-surface border border-dark-border rounded-2xl p-6 min-h-[300px] flex flex-col justify-between">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-dark-text">AI Engagement Rate</h3>
            <span className="text-xs text-dark-muted">Real-time Data</span>
          </div>
          <div className="h-48 border border-dashed border-dark-border rounded-xl flex items-center justify-center text-dark-muted text-sm">
            [ Interactive Chart Placeholder ]
          </div>
        </div>

        <div className="bg-dark-surface border border-dark-border rounded-2xl p-6">
          <h3 className="font-semibold text-dark-text mb-4">Recent AI Interactions</h3>
          <div className="space-y-4">
            {[1, 2, 3].map((item) => (
              <div key={item} className="p-3 bg-dark-bg rounded-xl border border-dark-border flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-brand-PRIMARY mt-2"></div>
                <div>
                  <p className="text-xs font-medium text-dark-text">Customer #109{item} inquired about order status.</p>
                  <span className="text-[10px] text-dark-muted">2 mins ago</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
