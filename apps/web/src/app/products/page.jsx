'use client';

import React, { useState, useEffect } from 'react';
import { fetchApi } from '../../lib/api';
import { Package, RefreshCw } from 'lucide-react';

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const data = await fetchApi('/products');
      setProducts(data.data || []);
    } catch (err) {
      console.error('Error fetching products:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-dark-text">Product Catalog</h2>
          <p className="text-sm text-dark-muted">Synced items available for AI recommendations.</p>
        </div>
        <button
          onClick={loadProducts}
          className="flex items-center gap-2 px-4 py-2 bg-dark-surface border border-dark-border hover:bg-dark-border/50 rounded-xl text-sm transition-colors w-fit"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Sync Products
        </button>
      </div>

      <div className="bg-dark-surface border border-dark-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-dark-text">
            <thead className="bg-dark-bg/60 border-b border-dark-border text-xs uppercase text-dark-muted">
              <tr>
                <th className="p-4">Product Name</th>
                <th className="p-4">Price</th>
                <th className="p-4">Status</th>
                <th className="p-4">Inventory</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border/50">
              {loading ? (
                <tr>
                  <td colSpan="4" className="p-8 text-center text-dark-muted">Loading inventory...</td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan="4" className="p-8 text-center text-dark-muted">No products synced yet.</td>
                </tr>
              ) : (
                products.map((item) => (
                  <tr key={item._id || item.id} className="hover:bg-dark-bg/30 transition-colors">
                    <td className="p-4 font-medium flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-dark-bg border border-dark-border text-brand-PRIMARY">
                        <Package className="w-4 h-4" />
                      </div>
                      {item.title || item.name}
                    </td>
                    <td className="p-4">${item.price || '0.00'}</td>
                    <td className="p-4">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Active
                      </span>
                    </td>
                    <td className="p-4 text-dark-muted">{item.inventoryQuantity ?? item.stock ?? 'In Stock'}</td>
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
