"use client";

/**
 * MercadoBitcoin WebSocket connector for order book data
 *
 * WebSocket API documentation:
 * https://www.mercadobitcoin.com.br/api-doc/
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
 * MercadoBitcoin-specific message formats
 */
interface MBSubscribeRequest {
  type: "subscribe";
  subscription: {
    name: "orderbook";
    id: string;
    limit?: number;
  };
}

interface MBSubscribeResponse {
  id: string;
  name: string;
  limit?: number;
}

interface MBOrderbookMessage {
  type: "orderbook";
  id: string;
  ts: number; // nanoseconds
  limit?: number;
  data: {
    timestamp: number; // nanoseconds
    asks: [number, number][]; // [price, volume]
    bids: [number, number][]; // [price, volume]
  };
}

interface MBPingRequest {
  type: "ping";
}

interface MBPongResponse {
  type: "pong";
}

interface MBErrorMessage {
  type: "error";
  message: string;
}

type MBMessage =
  | MBSubscribeResponse
  | MBOrderbookMessage
  | MBPongResponse
  | MBErrorMessage;

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
 * MercadoBitcoinConnector implements the exchange connector interface for MercadoBitcoin
 *
 * This class manages WebSocket connection to MercadoBitcoin's order book stream.
 * Unlike FoxBit, MercadoBitcoin sends complete orderbook snapshots in each message,
 * so no incremental update logic is needed.
 */
export class MercadoBitcoinConnector implements IExchangeConnector {
  public readonly exchange = "mercadobitcoin";

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
   * Connect to MercadoBitcoin WebSocket
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
      const url = "wss://ws.mercadobitcoin.net/ws";

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
   * Disconnect from MercadoBitcoin WebSocket
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

    // Start ping interval (every 20 seconds to stay within 5s requirement)
    this._startPingInterval();
  }

  /**
   * Handle WebSocket message event
   */
  private _handleMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data) as MBMessage;

      // Handle subscription success
      if ("name" in message && message.name === "orderbook") {
        console.log(`[${this.exchange}] Subscription successful`);
        return;
      }

      // Handle ping response
      if ("type" in message && message.type === "pong") {
        // Ping successful, no action needed
        return;
      }

      // Handle error
      if ("type" in message && message.type === "error") {
        console.error(`[${this.exchange}] Server error:`, message.message);
        this._emit({
          type: ConnectorEventType.ERROR,
          exchange: this.exchange,
          error: new Error(message.message),
          message: message.message,
        });
        return;
      }

      // Handle orderbook update
      if ("type" in message && message.type === "orderbook" && message.data) {
        this._processOrderbookData(message);
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
   * Process orderbook data (complete snapshot)
   */
  private _processOrderbookData(message: MBOrderbookMessage): void {
    // MercadoBitcoin sends complete snapshots, not incremental updates
    const orderBook: OrderBook = {
      exchange: this.exchange,
      symbol: this._config.symbol,
      bids: message.data.bids.map(([price, volume]) => ({
        price,
        quantity: volume,
      })),
      asks: message.data.asks.map(([price, volume]) => ({
        price,
        quantity: volume,
      })),
      timestamp: Math.floor(message.data.timestamp / 1_000_000), // Convert nanoseconds to milliseconds
      sequenceId: message.ts, // Use message timestamp as sequence
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

    const symbol = toExchangeSymbol(this._config.symbol, "mercadobitcoin");

    // Determine limit based on depth config
    let limit: number | undefined;
    if (this._config.depth) {
      // MercadoBitcoin supports: 10, 20, 50, 100, 200
      if (this._config.depth <= 10) limit = 10;
      else if (this._config.depth <= 20) limit = 20;
      else if (this._config.depth <= 50) limit = 50;
      else if (this._config.depth <= 100) limit = 100;
      else limit = 200;
    }

    const subscribeMessage: MBSubscribeRequest = {
      type: "subscribe",
      subscription: {
        name: "orderbook",
        id: symbol,
        ...(limit && {limit}),
      },
    };

    console.log(`[${this.exchange}] Subscribing to orderbook:`, symbol, `limit:`, limit);
    this._ws.send(JSON.stringify(subscribeMessage));
  }

  /**
   * Unsubscribe from orderbook channel
   */
  private _unsubscribeFromOrderbook(): void {
    if (!this._ws || this._ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const symbol = toExchangeSymbol(this._config.symbol, "mercadobitcoin");

    // Use same limit as subscription
    let limit: number | undefined;
    if (this._config.depth) {
      if (this._config.depth <= 10) limit = 10;
      else if (this._config.depth <= 20) limit = 20;
      else if (this._config.depth <= 50) limit = 50;
      else if (this._config.depth <= 100) limit = 100;
      else limit = 200;
    }

    const unsubscribeMessage = {
      type: "unsubscribe",
      subscription: {
        name: "orderbook",
        id: symbol,
        ...(limit && {limit}),
      },
    };

    console.log(`[${this.exchange}] Unsubscribing from orderbook`);
    this._ws.send(JSON.stringify(unsubscribeMessage));
  }

  /**
   * Start ping interval to keep connection alive
   */
  private _startPingInterval(): void {
    this._clearPingInterval();

    // Send ping every 20 seconds (well within the 5 second requirement)
    this._pingInterval = setInterval(() => {
      if (this._ws && this._ws.readyState === WebSocket.OPEN) {
        const pingMessage: MBPingRequest = {
          type: "ping",
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
