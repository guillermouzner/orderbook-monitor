"use client";

/**
 * FoxBit WebSocket connector for order book data
 *
 * WebSocket API documentation:
 * https://docs.foxbit.com.br/
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
 * FoxBit-specific message format
 */
interface FoxbitMessage {
  type: "subscribe" | "unsubscribe" | "message";
  event?: "success" | "error" | "snapshot" | "update";
  params: {
    channel: string;
    market_symbol?: string;
  };
  data?: FoxbitOrderbookData;
  message?: string;
}

/**
 * FoxBit orderbook snapshot data
 */
interface FoxbitOrderbookData {
  sequence_id?: number;
  first_sequence_id?: number;
  last_sequence_id?: number;
  ts?: number;
  asks: [string, string][];
  bids: [string, string][];
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: ConnectorConfig = {
  symbol: "BTC/BRL",
  depth: 20,
  reconnect: {
    enabled: true,
    maxAttempts: 5,
    delayMs: 1000,
    backoffMultiplier: 1.5,
  },
};

/**
 * FoxbitConnector implements the exchange connector interface for FoxBit
 *
 * This class manages WebSocket connection to FoxBit's order book stream,
 * handles subscription, ping/pong, reconnection logic, and normalizes data.
 */
export class FoxbitConnector implements IExchangeConnector {
  public readonly exchange = "foxbit";

  private _status: ConnectionStatus = ConnectionStatus.DISCONNECTED;
  private _orderBook: OrderBook | null = null;
  private _config: ConnectorConfig;
  private _ws: WebSocket | null = null;
  private _listeners = new Set<EventListener>();
  private _reconnectAttempts = 0;
  private _reconnectTimeout: NodeJS.Timeout | null = null;
  private _pingInterval: NodeJS.Timeout | null = null;

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
   * Connect to FoxBit WebSocket
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
      const url = "wss://api.foxbit.com.br/ws/v3/public";

      console.log(`[${this.exchange}] Connecting to:`, url);

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
   * Disconnect from FoxBit WebSocket
   */
  public disconnect(): void {
    this._clearReconnectTimeout();
    this._clearPingInterval();

    if (this._ws) {
      // Unsubscribe before closing
      if (this._ws.readyState === WebSocket.OPEN) {
        this._unsubscribeFromOrderbook();
      }

      this._ws.onopen = null;
      this._ws.onmessage = null;
      this._ws.onerror = null;
      this._ws.onclose = null;

      if (
        this._ws.readyState === WebSocket.OPEN ||
        this._ws.readyState === WebSocket.CONNECTING
      ) {
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

    // Subscribe to orderbook
    this._subscribeToOrderbook();

    // Start ping interval (every 20 seconds as recommended)
    this._startPingInterval();
  }

  /**
   * Handle WebSocket message event
   */
  private _handleMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data) as FoxbitMessage;

      // Handle subscription success
      if (message.type === "subscribe" && message.event === "success") {
        console.log(`[${this.exchange}] Subscription successful`);
        return;
      }

      // Handle subscription error
      if (message.type === "subscribe" && message.event === "error") {
        console.error(`[${this.exchange}] Subscription error:`, message.message);
        this._emit({
          type: ConnectorEventType.ERROR,
          exchange: this.exchange,
          error: new Error(message.message || "Subscription error"),
          message: message.message || "Subscription error",
        });
        return;
      }

      // Handle ping response
      if (message.type === "message" && message.params.channel === "ping") {
        // Ping successful, no action needed
        return;
      }

      // Handle orderbook snapshot
      if (message.type === "subscribe" && message.event === "snapshot" && message.data) {
        this._processOrderbookData(message.data);
        return;
      }

      // Handle orderbook update
      if (message.type === "subscribe" && message.event === "update" && message.data) {
        this._processOrderbookData(message.data);
        return;
      }
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
   * Process orderbook data (snapshot or update)
   */
  private _processOrderbookData(data: FoxbitOrderbookData): void {
    const orderBook: OrderBook = {
      exchange: this.exchange,
      symbol: this._config.symbol,
      bids: data.bids.map(([price, quantity]) => ({
        price: parseFloat(price),
        quantity: parseFloat(quantity),
      })),
      asks: data.asks.map(([price, quantity]) => ({
        price: parseFloat(price),
        quantity: parseFloat(quantity),
      })),
      timestamp: data.ts || Date.now(),
      sequenceId: data.last_sequence_id || data.sequence_id,
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

    this._clearPingInterval();

    if (this._status !== ConnectionStatus.DISCONNECTED) {
      this._setStatus(ConnectionStatus.DISCONNECTED, event.reason);
      this._scheduleReconnect();
    }
  }

  /**
   * Subscribe to orderbook channel
   */
  private _subscribeToOrderbook(): void {
    if (!this._ws || this._ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const symbol = toExchangeSymbol(this._config.symbol, "foxbit");

    const subscribeMessage = {
      type: "subscribe",
      params: [
        {
          channel: "orderbook-1000", // 1 second updates
          market_symbol: symbol,
          snapshot: true, // Request initial snapshot
        },
      ],
    };

    console.log(`[${this.exchange}] Subscribing to orderbook:`, symbol);
    this._ws.send(JSON.stringify(subscribeMessage));
  }

  /**
   * Unsubscribe from orderbook channel
   */
  private _unsubscribeFromOrderbook(): void {
    if (!this._ws || this._ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const symbol = toExchangeSymbol(this._config.symbol, "foxbit");

    const unsubscribeMessage = {
      type: "unsubscribe",
      params: [
        {
          channel: "orderbook-1000",
          market_symbol: symbol,
        },
      ],
    };

    console.log(`[${this.exchange}] Unsubscribing from orderbook`);
    this._ws.send(JSON.stringify(unsubscribeMessage));
  }

  /**
   * Start ping interval to keep connection alive
   */
  private _startPingInterval(): void {
    this._clearPingInterval();

    // Send ping every 20 seconds as recommended
    this._pingInterval = setInterval(() => {
      if (this._ws && this._ws.readyState === WebSocket.OPEN) {
        const pingMessage = {
          type: "message",
          params: [
            {
              channel: "ping",
            },
          ],
        };

        this._ws.send(JSON.stringify(pingMessage));
      }
    }, 20000);
  }

  /**
   * Clear ping interval
   */
  private _clearPingInterval(): void {
    if (this._pingInterval) {
      clearInterval(this._pingInterval);
      this._pingInterval = null;
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

    if (
      reconnectConfig.maxAttempts > 0 &&
      this._reconnectAttempts >= reconnectConfig.maxAttempts
    ) {
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
