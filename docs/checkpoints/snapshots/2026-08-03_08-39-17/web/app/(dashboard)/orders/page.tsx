"use client";

import React, { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";

interface OrderItem {
  id: string;
  quantity: number;
  price: string;
  product: { id: string; name: string; sku: string };
}

interface Order {
  id: string;
  status: string;
  createdAt: string;
  chemist: { id: string; name: string };
  distributor: { id: string; name: string };
  items: OrderItem[];
}

const STATUS_OPTIONS = ["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"];

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-600",
  CONFIRMED: "bg-blue-50 text-blue-600",
  SHIPPED: "bg-purple-50 text-purple-600",
  DELIVERED: "bg-primary-50 text-primary-700",
  CANCELLED: "bg-red-50 text-red-600",
};

function orderTotal(order: Order): number {
  return order.items.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const res = await apiClient.get("/api/orders/secondary");
      setOrders(res.data.data.orders || []);
    } catch (err) {
      console.error("Failed to fetch orders:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const updateStatus = async (orderId: string, status: string) => {
    setUpdatingId(orderId);
    try {
      await apiClient.put(`/api/orders/${orderId}`, { status });
      await fetchData();
    } catch (err) {
      alert("Failed to update order status.");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h1 className="text-2xl font-display font-bold text-gray-900">Secondary Orders</h1>
        <p className="text-sm text-gray-500 mt-1">Chemist orders routed to mapped distributors.</p>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
          <p className="text-gray-400 text-sm">No orders booked yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 uppercase tracking-wider border-b border-gray-100">
                <th className="px-6 py-3">Chemist</th>
                <th className="px-6 py-3">Distributor</th>
                <th className="px-6 py-3">Items</th>
                <th className="px-6 py-3">Total</th>
                <th className="px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-6 py-4 font-medium text-gray-800">{order.chemist.name}</td>
                  <td className="px-6 py-4 text-gray-600">{order.distributor.name}</td>
                  <td className="px-6 py-4 text-gray-600">
                    {order.items.map((i) => `${i.product.name} x${i.quantity}`).join(", ")}
                  </td>
                  <td className="px-6 py-4 font-semibold text-gray-800">
                    {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(
                      orderTotal(order)
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <select
                      value={order.status}
                      disabled={updatingId !== null}
                      onChange={(e) => updateStatus(order.id, e.target.value)}
                      className={`text-xs font-semibold px-2.5 py-1.5 rounded-full uppercase tracking-wider border-0 focus:outline-none focus:ring-1 focus:ring-primary-500 ${STATUS_STYLES[order.status] ?? "bg-gray-50 text-gray-600"}`}
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
