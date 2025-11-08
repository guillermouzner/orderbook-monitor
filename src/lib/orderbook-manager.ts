"use client";

/**
 * OrderBookManager - Central orchestrator for multiple exchange connectors
 *
 * This manager coordinates multiple exchange connectors, aggregates their data,
 * and provides a unified interface for the UI to consume order book updates.
 */

import {
  type IExchangeConnector,
  type OrderBook,
  type ConnectorEvent,
  ConnectionStatus,
  ConnectorEventType,
} from "./exchanges/types";

/**
 * Consolidated order book data from all exchanges
 */
export interface ConsolidatedOrderBook {
  /** Map of exchange name to its order book */
  byExchange: Map<string, OrderBook>;
  /** Timestamp of last update */
  lastUpdate: number;
  /** Trading pair symbol */
  symbol: string;
}

/**
 * Manager status information
 */
export interface ManagerStatus {
  /** Number of connected exchanges */
  connectedCount: number;
  /** Number of connecting exchanges */
  connectingCount: number;
  /** Number of disconnected exchanges */
  disconnectedCount: number;
  /** Number of exchanges with errors */
  errorCount: number;
  /** Map of exchange name to its connection status */
  byExchange: Map<string, ConnectionStatus>;
}

/**
 * Callback types for manager events
 */
export type OrderBookUpdateCallback = (data: ConsolidatedOrderBook) => void;

export type StatusUpdateCallback = (status: ManagerStatus) => void;

export type ErrorCallback = (error: {exchange: string; message: string; error: Error}) => void;

/**
 * Manager configuration
 */
export interface ManagerConfig {
  /** Debounce time for order book updates in milliseconds */
  debounceMs?: number;
}

const DEFAULT_CONFIG: ManagerConfig = {
  debounceMs: 100,
};

/**
 * OrderBookManager manages multiple exchange connectors and provides
 * consolidated order book data to the UI layer.
 */
export class OrderBookManager {
  private _connectors = new Map<string, IExchangeConnector>();
  private _orderBooks = new Map<string, OrderBook>();
  private _unsubscribers = new Map<string, () => void>();
  private _config: ManagerConfig;

  // Event callbacks
  private _orderBookCallbacks = new Set<OrderBookUpdateCallback>();
  private _statusCallbacks = new Set<StatusUpdateCallback>();
  private _errorCallbacks = new Set<ErrorCallback>();

  // Debouncing
  private _debounceTimeout: NodeJS.Timeout | null = null;
  private _pendingUpdate = false;

  constructor(config?: ManagerConfig) {
    this._config = {...DEFAULT_CONFIG, ...config};
  }

  /**
   * Register a new exchange connector
   */
  public registerConnector(connector: IExchangeConnector): void {
    if (this._connectors.has(connector.exchange)) {
      console.warn(`Connector for ${connector.exchange} already registered`);

      return;
    }

    this._connectors.set(connector.exchange, connector);

    // Subscribe to connector events
    const unsubscribe = connector.on(this._handleConnectorEvent.bind(this));

    this._unsubscribers.set(connector.exchange, unsubscribe);

    console.log(`[Manager] Registered connector: ${connector.exchange}`);
    this._emitStatusUpdate();
  }

  /**
   * Unregister an exchange connector
   */
  public unregisterConnector(exchange: string): void {
    const connector = this._connectors.get(exchange);

    if (!connector) {
      return;
    }

    // Disconnect if connected
    if (connector.status === ConnectionStatus.CONNECTED) {
      connector.disconnect();
    }

    // Unsubscribe from events
    const unsubscribe = this._unsubscribers.get(exchange);

    if (unsubscribe) {
      unsubscribe();
      this._unsubscribers.delete(exchange);
    }

    // Remove from maps
    this._connectors.delete(exchange);
    this._orderBooks.delete(exchange);

    console.log(`[Manager] Unregistered connector: ${exchange}`);
    this._emitStatusUpdate();
    this._emitOrderBookUpdate();
  }

  /**
   * Connect to all registered exchanges
   */
  public async connectAll(): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const connector of this._connectors.values()) {
      if (connector.status === ConnectionStatus.DISCONNECTED) {
        promises.push(
          connector.connect().catch((error) => {
            console.error(`Failed to connect to ${connector.exchange}:`, error);
          }),
        );
      }
    }

    await Promise.allSettled(promises);
  }

  /**
   * Disconnect from all exchanges
   */
  public disconnectAll(): void {
    for (const connector of this._connectors.values()) {
      if (connector.status !== ConnectionStatus.DISCONNECTED) {
        connector.disconnect();
      }
    }
  }

  /**
   * Get current consolidated order book data
   */
  public getConsolidatedOrderBook(): ConsolidatedOrderBook {
    const symbol = this._getCommonSymbol();

    return {
      byExchange: new Map(this._orderBooks),
      lastUpdate: Date.now(),
      symbol,
    };
  }

  /**
   * Get current manager status
   */
  public getStatus(): ManagerStatus {
    const statusMap = new Map<string, ConnectionStatus>();
    let connectedCount = 0;
    let connectingCount = 0;
    let disconnectedCount = 0;
    let errorCount = 0;

    for (const connector of this._connectors.values()) {
      statusMap.set(connector.exchange, connector.status);

      switch (connector.status) {
        case ConnectionStatus.CONNECTED:
          connectedCount++;
          break;
        case ConnectionStatus.CONNECTING:
        case ConnectionStatus.RECONNECTING:
          connectingCount++;
          break;
        case ConnectionStatus.DISCONNECTED:
          disconnectedCount++;
          break;
        case ConnectionStatus.ERROR:
          errorCount++;
          break;
      }
    }

    return {
      connectedCount,
      connectingCount,
      disconnectedCount,
      errorCount,
      byExchange: statusMap,
    };
  }

  /**
   * Subscribe to order book updates
   */
  public onOrderBookUpdate(callback: OrderBookUpdateCallback): () => void {
    this._orderBookCallbacks.add(callback);

    return () => {
      this._orderBookCallbacks.delete(callback);
    };
  }

  /**
   * Subscribe to status updates
   */
  public onStatusUpdate(callback: StatusUpdateCallback): () => void {
    this._statusCallbacks.add(callback);

    return () => {
      this._statusCallbacks.delete(callback);
    };
  }

  /**
   * Subscribe to errors
   */
  public onError(callback: ErrorCallback): () => void {
    this._errorCallbacks.add(callback);

    return () => {
      this._errorCallbacks.delete(callback);
    };
  }

  /**
   * Cleanup all resources
   */
  public destroy(): void {
    // Clear debounce timeout
    if (this._debounceTimeout) {
      clearTimeout(this._debounceTimeout);
      this._debounceTimeout = null;
    }

    // Disconnect all connectors
    this.disconnectAll();

    // Unsubscribe from all connectors
    for (const unsubscribe of this._unsubscribers.values()) {
      unsubscribe();
    }

    // Clear all maps and sets
    this._connectors.clear();
    this._orderBooks.clear();
    this._unsubscribers.clear();
    this._orderBookCallbacks.clear();
    this._statusCallbacks.clear();
    this._errorCallbacks.clear();

    console.log("[Manager] Destroyed");
  }

  /**
   * Handle events from connectors
   */
  private _handleConnectorEvent(event: ConnectorEvent): void {
    switch (event.type) {
      case ConnectorEventType.ORDER_BOOK_UPDATE:
        this._orderBooks.set(event.data.exchange, event.data);
        this._emitOrderBookUpdate();
        break;

      case ConnectorEventType.STATUS_CHANGE:
        this._emitStatusUpdate();
        break;

      case ConnectorEventType.ERROR:
        this._emitError({
          exchange: event.exchange,
          message: event.message,
          error: event.error,
        });
        break;
    }
  }

  /**
   * Emit order book update with debouncing
   */
  private _emitOrderBookUpdate(): void {
    if (this._debounceTimeout) {
      this._pendingUpdate = true;

      return;
    }

    const data = this.getConsolidatedOrderBook();

    for (const callback of this._orderBookCallbacks) {
      try {
        callback(data);
      } catch (error) {
        console.error("[Manager] Error in order book callback:", error);
      }
    }

    // Set up debounce
    if (this._config.debounceMs && this._config.debounceMs > 0) {
      this._debounceTimeout = setTimeout(() => {
        this._debounceTimeout = null;

        if (this._pendingUpdate) {
          this._pendingUpdate = false;
          this._emitOrderBookUpdate();
        }
      }, this._config.debounceMs);
    }
  }

  /**
   * Emit status update
   */
  private _emitStatusUpdate(): void {
    const status = this.getStatus();

    for (const callback of this._statusCallbacks) {
      try {
        callback(status);
      } catch (error) {
        console.error("[Manager] Error in status callback:", error);
      }
    }
  }

  /**
   * Emit error
   */
  private _emitError(error: {exchange: string; message: string; error: Error}): void {
    for (const callback of this._errorCallbacks) {
      try {
        callback(error);
      } catch (err) {
        console.error("[Manager] Error in error callback:", err);
      }
    }
  }

  /**
   * Get common symbol from all connectors
   */
  private _getCommonSymbol(): string {
    const firstConnector = this._connectors.values().next().value;

    return firstConnector?.orderBook?.symbol || "UNKNOWN";
  }
}
