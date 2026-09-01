import { globalA2ABroker, A2ABroker } from "./a2a.broker";
import { A2AAgent, A2AMessage } from "./a2a.types";
import {
  ProductsA2AAgent,
  InventoryA2AAgent,
  PurchaseA2AAgent,
  SalesA2AAgent,
  FinanceA2AAgent,
  ComplianceA2AAgent,
  CouncilCoordinatorA2AAgent,
  DatabaseA2AAgent,
} from "./a2a.agents";

/**
 * High-level Developer-Friendly A2A (Agent-to-Agent) Client
 */
export class A2AClient {
  private broker: A2ABroker;
  private initialized = false;

  constructor(broker: A2ABroker = globalA2ABroker) {
    this.broker = broker;
    this.ensureInitialized();
  }

  /**
   * Automatically bootstrap and register all standard domain agents
   */
  private ensureInitialized() {
    if (this.initialized) return;

    this.broker.registerAgent(new ProductsA2AAgent());
    this.broker.registerAgent(new InventoryA2AAgent());
    this.broker.registerAgent(new PurchaseA2AAgent());
    this.broker.registerAgent(new SalesA2AAgent());
    this.broker.registerAgent(new FinanceA2AAgent());
    this.broker.registerAgent(new ComplianceA2AAgent());
    this.broker.registerAgent(new CouncilCoordinatorA2AAgent());
    this.broker.registerAgent(new DatabaseA2AAgent());

    this.initialized = true;
  }

  /**
   * Register a custom agent
   */
  register(agent: A2AAgent) {
    this.broker.registerAgent(agent);
  }

  /**
   * Send a synchronous request from one agent to another
   */
  async request<TReq = any, TRes = any>(
    recipient: string,
    action: string,
    payload: TReq = {} as any,
    options?: { sender?: string; timeoutMs?: number; priority?: "HIGH" | "NORMAL" | "LOW" }
  ): Promise<TRes> {
    const sender = options?.sender ?? "APP_CLIENT";
    return this.broker.request<TReq, TRes>(sender, recipient, action, payload, options);
  }

  /**
   * Emit an event across the A2A mesh
   */
  async emit<T = any>(eventName: string, payload: T, sender = "APP_CLIENT"): Promise<void> {
    return this.broker.emit<T>(sender, eventName, payload);
  }

  /**
   * Listen for an A2A event
   */
  on(eventName: string, handler: (event: A2AMessage) => Promise<void> | void): () => void {
    return this.broker.on(eventName, handler);
  }

  /**
   * Get Live Telemetry & Health of all agents across the A2A mesh
   */
  async getStatusBoard() {
    return this.broker.getStatusBoard();
  }

  /**
   * List all registered agents and their actions
   */
  listAgents() {
    return this.broker.listAgents();
  }
}

// Global A2A Singleton
export const A2A = new A2AClient();
