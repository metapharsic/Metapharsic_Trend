import { api } from "./api";

export interface ExpenseClaimPayload {
  amount: number;
  category: "TRAVEL" | "DA" | "HOTEL" | "MISC";
  date: string;
  description?: string;
  receiptFileUri?: string;
  receiptHash?: string;
}

export const expenseService = {
  // Submit an expense claim with optional receipt
  submitClaim: async (payload: ExpenseClaimPayload) => {
    const formData = new FormData();
    formData.append("amount", String(payload.amount));
    formData.append("category", payload.category);
    formData.append("date", payload.date);
    if (payload.description) formData.append("description", payload.description);
    if (payload.receiptHash) formData.append("receiptHash", payload.receiptHash);

    if (payload.receiptFileUri) {
      formData.append("receipt", {
        uri: payload.receiptFileUri,
        name: `receipt_${Date.now()}.jpg`,
        type: "image/jpeg",
      } as unknown as Blob);
    }

    const res = await api.post("/expenses/claims/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data.data;
  },

  // Fetch MR's expense claim history
  getClaims: async (params?: { page?: number; limit?: number }) => {
    const res = await api.get("/expenses/claims", { params });
    return res.data.data;
  },
};
