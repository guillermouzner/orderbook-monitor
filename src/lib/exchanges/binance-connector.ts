"use client";

/**
 * Binance WebSocket connector for order book data
 *
 * WebSocket API documentation:
 * https://binance-docs.github.io/apidocs/spot/en/#websocket-market-streams
 */

import {
  type IExchangeConnector,
  type ConnectorConfig,
  type OrderBook,
  type EventListener,
  type ConnectorEvent,
  ConnectionStatus,
  ConnectorEventType,
  toExchangeSymbol,
  trimOrderBook,
} from "./types";

/**
 * Binance-specific order book message format
 */
interface BinanceDepthUpdate {
  e: string; // Event type
  E: number; // Event time
  s: string; // Symbol
  U: number; // First update ID in event
  u: number; // Final update ID in event
  b: [string, string][]; // Bids to be updated [price, quantity]
  a: [string, string][]; // Asks to be updated [price, quantity]
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: ConnectorConfig = {
  symbol: "BTC/USDT",
  depth: 20,
  reconnect: {
    enabled: true,
    maxAttempts: 5,
    delayMs: 1000,
    backoffMultiplier: 1.5,
  },
};

/**
 * BinanceConnector implements the exchange connector interface for Binance
 *
 * This class manages WebSocket connection to Binance's order book stream,
 * handles reconnection logic, and normalizes data to the common format.
 */
export class BinanceConnector implements IExchangeConnector {
  public readonly exchange = "binance";

  private _status: ConnectionStatus = ConnectionStatus.DISCONNECTED;
  private _orderBook: OrderBook | null = null;
  private _config: ConnectorConfig;
  private _ws: WebSocket | null = null;
  private _listeners = new Set<EventListener>();
  private _reconnectAttempts = 0;
  private _reconnectTimeout: NodeJS.Timeout | null = null;

  constructor(config?: Partial<ConnectorConfig>) {
    this._config = {...DEFAULT_CONFIG, ...config};
  }

  public get status(): ConnectionStatus {
    return this._status;
  }

  public get orderBook(): OrderBook | null {
    return this._orderBook;
  }

  /**
   * Connect to Binance WebSocket
   */
  public async connect(): Promise<void> {
    if (
      this._status === ConnectionStatus.CONNECTED ||
      this._status === ConnectionStatus.CONNECTING
    ) {
      return;
    }

    this._setStatus(ConnectionStatus.CONNECTING);

    try {
      const symbol = toExchangeSymbol(this._config.symbol, "binance");
      // Binance depth stream: wss://stream.binance.com:9443/ws/<symbol>@depth<levels>@100ms
      // Using @depth20 for top 20 levels, updated every 100ms
      const url = `wss://stream.binance.com:9443/ws/${symbol}@depth20@100ms`;

      this._ws = new WebSocket(url);

      this._ws.onopen = this._handleOpen.bind(this);
      this._ws.onmessage = this._handleMessage.bind(this);
      this._ws.onerror = this._handleError.bind(this);
      this._ws.onclose = this._handleClose.bind(this);

      // Wait for connection to be established
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Connection timeout"));
        }, 10000);

        const checkConnection = () => {
          if (this._status === ConnectionStatus.CONNECTED) {
            clearTimeout(timeout);
            resolve();
          } else if (this._status === ConnectionStatus.ERROR) {
            clearTimeout(timeout);
            reject(new Error("Connection failed"));
          } else {
            setTimeout(checkConnection, 100);
          }
        };

        checkConnection();
      });
    } catch (error) {
      this._setStatus(ConnectionStatus.ERROR, `Failed to connect: ${error}`);
      this._scheduleReconnect();
      throw error;
    }
  }

  /**
   * Disconnect from Binance WebSocket
   */
  public disconnect(): void {
    this._clearReconnectTimeout();

    if (this._ws) {
      this._ws.onopen = null;
      this._ws.onmessage = null;
      this._ws.onerror = null;
      this._ws.onclose = null;

      if (this._ws.readyState === WebSocket.OPEN || this._ws.readyState === WebSocket.CONNECTING) {
        this._ws.close();
      }

      this._ws = null;
    }

    this._setStatus(ConnectionStatus.DISCONNECTED);
    this._orderBook = null;
    this._reconnectAttempts = 0;
  }

  /**
   * Subscribe to events
   */
  public on(listener: EventListener): () => void {
    this._listeners.add(listener);

    return () => {
      this._listeners.delete(listener);
    };
  }

  /**
   * Update configuration and reconnect if needed
   */
  public updateConfig(config: Partial<ConnectorConfig>): void {
    const wasConnected = this._status === ConnectionStatus.CONNECTED;

    if (wasConnected) {
      this.disconnect();
    }

    this._config = {...this._config, ...config};

    if (wasConnected) {
      this.connect().catch((error) => {
        console.error("Failed to reconnect after config update:", error);
      });
    }
  }

  /**
   * Handle WebSocket open event
   */
  private _handleOpen(): void {
    console.log(`[${this.exchange}] WebSocket connected`);
    this._setStatus(ConnectionStatus.CONNECTED);
    this._reconnectAttempts = 0;
  }

  /**
   * Handle WebSocket message event
   */
  private _handleMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data) as BinanceDepthUpdate;

      console.log("data", data);

      if (data.e !== "depthUpdate") {
        return;
      }

      // Convert Binance format to normalized format
      const orderBook: OrderBook = {
        exchange: this.exchange,
        symbol: this._config.symbol,
        bids: data.b.map(([price, quantity]) => ({
          price: parseFloat(price),
          quantity: parseFloat(quantity),
        })),
        asks: data.a.map(([price, quantity]) => ({
          price: parseFloat(price),
          quantity: parseFloat(quantity),
        })),
        timestamp: Date.now(),
        sequenceId: data.u,
      };

      // Apply depth limit if configured
      if (this._config.depth) {
        this._orderBook = trimOrderBook(orderBook, this._config.depth);
      } else {
        this._orderBook = orderBook;
      }

      // Emit update event
      this._emit({
        type: ConnectorEventType.ORDER_BOOK_UPDATE,
        data: this._orderBook,
      });
    } catch (error) {
      console.error(`[${this.exchange}] Failed to parse message:`, error);
      this._emit({
        type: ConnectorEventType.ERROR,
        exchange: this.exchange,
        error: error as Error,
        message: `Failed to parse message: ${error}`,
      });
    }
  }

  /**
   * Handle WebSocket error event
   */
  private _handleError(event: Event): void {
    console.error(`[${this.exchange}] WebSocket error:`, event);
    this._emit({
      type: ConnectorEventType.ERROR,
      exchange: this.exchange,
      error: new Error("WebSocket error"),
      message: "WebSocket error occurred",
    });
  }

  /**
   * Handle WebSocket close event
   */
  private _handleClose(event: CloseEvent): void {
    console.log(`[${this.exchange}] WebSocket closed:`, event.code, event.reason);

    if (this._status !== ConnectionStatus.DISCONNECTED) {
      this._setStatus(ConnectionStatus.DISCONNECTED, event.reason);
      this._scheduleReconnect();
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private _scheduleReconnect(): void {
    const reconnectConfig = this._config.reconnect;

    if (!reconnectConfig?.enabled) {
      return;
    }

    if (reconnectConfig.maxAttempts > 0 && this._reconnectAttempts >= reconnectConfig.maxAttempts) {
      console.log(`[${this.exchange}] Max reconnection attempts reached`);
      this._setStatus(ConnectionStatus.ERROR, "Max reconnection attempts reached");

      return;
    }

    this._reconnectAttempts++;

    // Calculate delay with exponential backoff
    const baseDelay = reconnectConfig.delayMs;
    const multiplier = reconnectConfig.backoffMultiplier || 1;
    const delay = baseDelay * Math.pow(multiplier, this._reconnectAttempts - 1);

    console.log(
      `[${this.exchange}] Reconnecting in ${delay}ms (attempt ${this._reconnectAttempts})`,
    );
    this._setStatus(ConnectionStatus.RECONNECTING, `Reconnecting in ${delay}ms`);

    this._reconnectTimeout = setTimeout(() => {
      this.connect().catch((error) => {
        console.error(`[${this.exchange}] Reconnection failed:`, error);
      });
    }, delay);
  }

  /**
   * Clear reconnection timeout
   */
  private _clearReconnectTimeout(): void {
    if (this._reconnectTimeout) {
      clearTimeout(this._reconnectTimeout);
      this._reconnectTimeout = null;
    }
  }

  /**
   * Set connection status and emit event
   */
  private _setStatus(status: ConnectionStatus, message?: string): void {
    if (this._status === status) {
      return;
    }

    this._status = status;

    this._emit({
      type: ConnectorEventType.STATUS_CHANGE,
      status,
      exchange: this.exchange,
      message,
    });
  }

  /**
   * Emit event to all listeners
   */
  private _emit(event: ConnectorEvent): void {
    this._listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.error(`[${this.exchange}] Error in event listener:`, error);
      }
    });
  }
}
