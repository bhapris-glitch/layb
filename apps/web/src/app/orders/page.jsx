'use client';

import React, { useState, useEffect } from 'react';
import { fetchApi } from '../../lib/api';
import { ShoppingBag } from 'lucide-react';

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadOrders() {
      try {
        const data = await fetchApi('/orders');
        setOrders(data.data || []);
      } catch (err) {
        console.error('Error fetching orders:', err);
      } finally {
        setLoading(false);
      }
    }
    loadOrders();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-dark-text">Store Orders</h2>
        <p className="text-sm text-dark-muted">Orders placed and handled via store checkout and AI support.</p>
      </div>

      <div className="bg-dark-surface border border-dark-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-dark-text">
            <thead className="bg-dark-bg/60 border-b border-dark-border text-xs uppercase text-dark-muted">
              <tr>
                <th className="p-4">Order ID</th>
                <th className="p-4">Customer</th>
                <th className="p-4">Total</th>
                <th className="p-4">Payment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border/50">
              {loading ? (
                <tr>
                  <td colSpan="4" className="p-8 text-center text-dark-muted">Fetching orders...</td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan="4" className="p-8 text-center text-dark-muted">No orders found.</td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order._id || order.id} className="hover:bg-dark-bg/30 transition-colors">
                    <td className="p-4 font-mono text-xs text-brand-PRIMARY flex items-center gap-2">
                      <ShoppingBag className="w-4 h-4 text-dark-muted" />
                      #{order.orderNumber || order._id?.slice(-6)}
                    </td>
                    <td className="p-4 font-medium">{order.customerName || 'Guest Customer'}</td>
                    <td className="p-4">${order.totalPrice || '0.00'}</td>
                    <td className="p-4">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Paid
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
