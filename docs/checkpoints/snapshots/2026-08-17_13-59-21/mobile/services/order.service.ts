import { api } from "./api";
import { storageService } from "./storage.service";

export interface OrderItemInput {
  productId: string;
  quantity: number;
}

export interface CreateOrderPayload {
  chemistId: string;
  distributorId: string;
  items: OrderItemInput[];
}

export const orderService = {
  // Fetch available products
  getProducts: async () => {
    const res = await api.get("/products");
    return res.data.data?.products ?? [];
  },

  // Book a secondary order
  createOrder: async (payload: CreateOrderPayload) => {
    try {
      const res = await api.post("/orders/secondary", payload);
      return res.data.data;
    } catch (err) {
      // If offline, queue order locally
      const queuedId = `offline_order_${Date.now()}`;
      await storageService.enqueueOrder({
        id: queuedId,
        queuedAt: new Date().toISOString(),
        payload,
      });
      return {
        order: { id: queuedId, status: "OFFLINE_QUEUED" },
        offline: true,
      };
    }
  },

  // Fetch MR order history
  getOrderHistory: async (params?: { page?: number; limit?: number }) => {
    const res = await api.get("/orders/secondary", { params });
    return res.data.data;
  },

  // Record payment collection
  recordCollection: async (payload: {
    chemistId: string;
    amount: number;
    paymentMode: "CASH" | "CHEQUE" | "NEFT" | "UPI";
    invoiceNumber?: string;
    referenceNumber?: string;
    notes?: string;
  }) => {
    const res = await api.post("/mr/collections", payload);
    return res.data.data;
  },
};
