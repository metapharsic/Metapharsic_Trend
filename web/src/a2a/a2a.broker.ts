import {
  A2AAgent,
  A2AMessage,
  A2AResponse,
  A2AAgentStatus,
  A2AAgentMetrics,
} from "./a2a.types";

export type A2AEventHandler = (event: A2AMessage) => Promise<void> | void;

export class A2ABroker {
  private agents: Map<string, A2AAgent> = new Map();
  private eventHandlers: Map<string, Set<A2AEventHandler>> = new Map();
  private metrics: Map<string, A2AAgentMetrics> = new Map();

  /**
   * Register an autonomous agent into the A2A broker mesh
   */
  registerAgent(agent: A2AAgent): void {
    this.agents.set(agent.agentCode, agent);
    if (!this.metrics.has(agent.agentCode)) {
      this.metrics.set(agent.agentCode, {
        requestsHandled: 0,
        eventsEmitted: 0,
        eventsReceived: 0,
        avgLatencyMs: 0,
        lastActiveAt: new Date().toISOString(),
      });
    }
    console.log(`[A2A Broker] 🔌 Agent Registered: [${agent.agentCode}] ${agent.agentName} (${agent.capabilities.length} capabilities)`);
  }

  /**
   * Unregister an agent from the mesh
   */
  unregisterAgent(agentCode: string): void {
    this.agents.delete(agentCode);
  }

  /**
   * Get an agent by code
   */
  getAgent(agentCode: string): A2AAgent | undefined {
    return this.agents.get(agentCode);
  }

  /**
   * List all registered agents and their capability metadata
   */
  listAgents(): Array<{
    agentCode: string;
    agentName: string;
    domain: string;
    capabilities: string[];
  }> {
    return Array.from(this.agents.values()).map((a) => ({
      agentCode: a.agentCode,
      agentName: a.agentName,
      domain: a.domain,
      capabilities: a.capabilities.map((c) => c.action),
    }));
  }

  /**
   * Send a synchronous A2A Request from one agent to another with timeout & tracing
   */
  async request<TReq = any, TRes = any>(
    sender: string,
    recipient: string,
    action: string,
    payload: TReq,
    options?: { timeoutMs?: number; priority?: "HIGH" | "NORMAL" | "LOW" }
  ): Promise<TRes> {
    const target = this.agents.get(recipient);
    if (!target) {
      throw new Error(`[A2A Broker] Target agent '${recipient}' not found in registry`);
    }

    const correlationId = `corr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const message: A2AMessage<TReq> = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: "REQUEST",
      sender,
      recipient,
      action,
      payload,
      correlationId,
      timestamp: new Date().toISOString(),
      metadata: {
        priority: options?.priority ?? "NORMAL",
        timeoutMs: options?.timeoutMs ?? 10000,
        environment: process.env.NODE_ENV === "production" ? "VPS_PRODUCTION" : "LOCAL",
      },
    };

    const t0 = performance.now();
    let response: A2AResponse;

    try {
      response = await target.handleMessage(message);
    } catch (err: any) {
      const execTime = Math.round(performance.now() - t0);
      response = {
        success: false,
        correlationId,
        responder: recipient,
        error: {
          code: "A2A_EXECUTION_ERROR",
          message: err.message || "Agent execution failed",
          details: err,
        },
        executionTimeMs: execTime,
        timestamp: new Date().toISOString(),
      };
    }

    const elapsed = Math.round(performance.now() - t0);

    // Update recipient agent metrics
    const m = this.metrics.get(recipient);
    if (m) {
      m.requestsHandled++;
      m.avgLatencyMs = Math.round((m.avgLatencyMs + elapsed) / 2);
      m.lastActiveAt = new Date().toISOString();
    }

    // Background asynchronous DB-A2A trace logging
    const dbAgent = this.agents.get("DATABASE_AGENT");
    if (dbAgent && recipient !== "DATABASE_AGENT") {
      dbAgent.handleMessage({
        id: `log-${Date.now()}`,
        type: "COMMAND",
        sender: "A2A_BROKER",
        recipient: "DATABASE_AGENT",
        action: "LOG_MESSAGE",
        payload: {
          correlationId,
          type: "REQUEST",
          sender,
          recipient,
          action,
          payload,
          responseData: response.data,
          status: response.success ? "COMPLETED" : "FAILED",
          executionTimeMs: elapsed,
          errorMessage: response.error?.message,
        },
        correlationId,
        timestamp: new Date().toISOString(),
      }).catch(() => {});
    }

    if (!response.success) {
      throw new Error(`[A2A Error from ${recipient}:${action}] ${response.error?.message || "Unknown error"}`);
    }

    return response.data as TRes;
  }

  /**
   * Broadcast an A2A event across the entire mesh
   */
  async emit<T = any>(sender: string, eventName: string, payload: T): Promise<void> {
    const correlationId = `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const message: A2AMessage<T> = {
      id: `evt-msg-${Date.now()}`,
      type: "EVENT",
      sender,
      recipient: "*",
      action: eventName,
      payload,
      correlationId,
      timestamp: new Date().toISOString(),
    };

    // Update sender metrics
    const senderMetrics = this.metrics.get(sender);
    if (senderMetrics) {
      senderMetrics.eventsEmitted++;
      senderMetrics.lastActiveAt = new Date().toISOString();
    }

    // 1. Deliver to registered event listeners
    const handlers = this.eventHandlers.get(eventName);
    if (handlers && handlers.size > 0) {
      await Promise.all(Array.from(handlers).map((h) => h(message)));
    }

    // 2. Deliver to any agent that declares event support
    const agentPromises = Array.from(this.agents.values())
      .filter((a) => a.capabilities.some((c) => c.action === eventName || c.action === "*"))
      .map(async (agent) => {
        try {
          await agent.handleMessage(message);
          const m = this.metrics.get(agent.agentCode);
          if (m) m.eventsReceived++;
        } catch (e) {
          console.warn(`[A2A Broker] Error handling event ${eventName} by ${agent.agentCode}:`, e);
        }
      });

    await Promise.all(agentPromises);
  }

  /**
   * Subscribe an event listener for an A2A event
   */
  on(eventName: string, handler: A2AEventHandler): () => void {
    if (!this.eventHandlers.has(eventName)) {
      this.eventHandlers.set(eventName, new Set());
    }
    this.eventHandlers.get(eventName)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.eventHandlers.get(eventName)?.delete(handler);
    };
  }

  /**
   * Get Live Telemetry & Health of all agents across the A2A mesh
   */
  async getStatusBoard(): Promise<{
    totalAgents: number;
    agentsOnline: number;
    timestamp: string;
    agents: Array<{
      agentCode: string;
      agentName: string;
      domain: string;
      status: A2AAgentStatus;
      score: number;
      metrics: A2AAgentMetrics;
      domainMetrics: Record<string, any>;
      findings: string[];
      warnings: string[];
    }>;
  }> {
    const agentStatuses = await Promise.all(
      Array.from(this.agents.values()).map(async (agent) => {
        const diag = await agent.getStatus();
        const brokerMetrics = this.metrics.get(agent.agentCode) ?? {
          requestsHandled: 0,
          eventsEmitted: 0,
          eventsReceived: 0,
          avgLatencyMs: 0,
          lastActiveAt: new Date().toISOString(),
        };

        return {
          agentCode: agent.agentCode,
          agentName: agent.agentName,
          domain: agent.domain,
          status: diag.status,
          score: diag.score,
          metrics: brokerMetrics,
          domainMetrics: diag.metrics,
          findings: diag.findings,
          warnings: diag.warnings,
        };
      })
    );

    const onlineCount = agentStatuses.filter(
      (a) => a.status === "ONLINE_PASS" || a.status === "ONLINE_WARNING"
    ).length;

    return {
      totalAgents: this.agents.size,
      agentsOnline: onlineCount,
      timestamp: new Date().toISOString(),
      agents: agentStatuses,
    };
  }
}

export const globalA2ABroker = new A2ABroker();
