export type A2AMessageType = "REQUEST" | "RESPONSE" | "EVENT" | "COMMAND" | "HEARTBEAT";

export type A2AAgentStatus = "ONLINE_PASS" | "ONLINE_WARNING" | "ONLINE_ALERT" | "IDLE" | "ERROR";

export interface A2AMessageMetadata {
  priority?: "HIGH" | "NORMAL" | "LOW";
  traceId?: string;
  timeoutMs?: number;
  environment?: "LOCAL" | "VPS_PRODUCTION";
}

export interface A2AMessage<T = any> {
  id: string;
  type: A2AMessageType;
  sender: string;
  recipient: string; // Agent code or '*' for broadcast
  action: string;
  payload: T;
  correlationId: string;
  timestamp: string;
  metadata?: A2AMessageMetadata;
}

export interface A2AResponse<T = any> {
  success: boolean;
  correlationId: string;
  responder: string;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  executionTimeMs: number;
  timestamp: string;
}

export interface A2AAgentCapability {
  action: string;
  description: string;
  inputSchema?: string;
  outputSchema?: string;
}

export interface A2AAgentMetrics {
  requestsHandled: number;
  eventsEmitted: number;
  eventsReceived: number;
  avgLatencyMs: number;
  lastActiveAt: string;
}

export interface A2AAgent {
  agentCode: string;
  agentName: string;
  domain: string;
  capabilities: A2AAgentCapability[];
  getStatus(): Promise<{
    status: A2AAgentStatus;
    score: number;
    metrics: Record<string, any>;
    findings: string[];
    warnings: string[];
  }>;
  handleMessage(message: A2AMessage): Promise<A2AResponse>;
}
