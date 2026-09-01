/**
 * System Health & Forensic Error Sentinel
 * Captures, stores, and exposes comprehensive diagnostic information
 * for any system, API, or runtime error across the entire application.
 */

export interface SystemErrorRecord {
  id: string;
  timestamp: string; // ISO string with full seconds
  timeDisplay: string; // e.g. "10:24:15 AM"
  url?: string;
  method?: string;
  status?: number;
  statusText?: string;
  errorMessage: string;
  errorDetails?: any;
  requestPayload?: any;
  componentStack?: string;
  suggestedRemedy: string;
  severity: "CRITICAL" | "ERROR" | "WARNING" | "INFO";
}

type ErrorListener = (errors: SystemErrorRecord[]) => void;

class SystemHealthManager {
  private errors: SystemErrorRecord[] = [];
  private listeners: Set<ErrorListener> = new Set();
  private maxStored = 50;

  constructor() {
    if (typeof window !== "undefined") {
      // Global window unhandled error listener
      window.addEventListener("error", (event) => {
        this.recordError({
          errorMessage: event.message || "Unhandled client script error",
          errorDetails: event.error?.stack || event.filename ? `${event.filename}:${event.lineno}` : undefined,
          severity: "ERROR",
          suggestedRemedy: "A JavaScript runtime exception occurred on this screen. Refresh the page or check recent code changes.",
        });
      });

      // Global unhandled promise rejection listener
      window.addEventListener("unhandledrejection", (event) => {
        const reason = event.reason;
        this.recordError({
          errorMessage: reason?.message || String(reason) || "Unhandled async Promise rejection",
          errorDetails: reason?.stack || reason,
          severity: "ERROR",
          suggestedRemedy: "An asynchronous operation failed without a catch block. Review the error details below.",
        });
      });
    }
  }

  public recordError(params: {
    url?: string;
    method?: string;
    status?: number;
    statusText?: string;
    errorMessage: string;
    errorDetails?: any;
    requestPayload?: any;
    componentStack?: string;
    suggestedRemedy?: string;
    severity?: "CRITICAL" | "ERROR" | "WARNING" | "INFO";
  }): SystemErrorRecord {
    const now = new Date();
    const timeDisplay = now.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });

    let remedy = params.suggestedRemedy;
    if (!remedy) {
      if (params.status === 401) {
        remedy = "Session expired or missing JWT token. Please re-login to restore access.";
      } else if (params.status === 403) {
        remedy = "Your current user role does not have permission for this resource. Check RBAC permissions.";
      } else if (params.status === 404) {
        remedy = "The requested resource or endpoint was not found. Verify the URL or database ID.";
      } else if (params.status === 400) {
        remedy = "Invalid input or validation error. Review required fields and payload structure.";
      } else if (params.status && params.status >= 500) {
        remedy = "Internal server error occurred. Check database connectivity or backend logs in /api/logs.";
      } else if (!params.status) {
        remedy = "Network disconnect or connection refused. Check your internet connection or server status.";
      } else {
        remedy = "Inspect the full payload below for specific debugging details.";
      }
    }

    const record: SystemErrorRecord = {
      id: `err_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: now.toISOString(),
      timeDisplay,
      url: params.url,
      method: params.method?.toUpperCase(),
      status: params.status,
      statusText: params.statusText,
      errorMessage: params.errorMessage || "Unknown error",
      errorDetails: params.errorDetails,
      requestPayload: params.requestPayload,
      componentStack: params.componentStack,
      suggestedRemedy: remedy,
      severity: params.severity || (params.status && params.status >= 500 ? "CRITICAL" : "ERROR"),
    };

    this.errors.unshift(record);
    if (this.errors.length > this.maxStored) {
      this.errors.pop();
    }

    this.notifyListeners();
    return record;
  }

  public getErrors(): SystemErrorRecord[] {
    return [...this.errors];
  }

  public clearErrors() {
    this.errors = [];
    this.notifyListeners();
  }

  public subscribe(listener: ErrorListener): () => void {
    this.listeners.add(listener);
    listener(this.getErrors());
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    const list = this.getErrors();
    for (const listener of this.listeners) {
      try {
        listener(list);
      } catch (e) {
        console.error("Error in error listener:", e);
      }
    }
  }
}

export const systemHealth = new SystemHealthManager();
