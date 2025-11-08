/**
 * Order book types and interfaces for multi-exchange integration
 */

/**
 * Represents a single order (bid or ask) in the order book
 */
export interface OrderBookEntry {
  /** Price level */
  price: number;
  /** Quantity/amount available at this price */
  quantity: number;
  /** Total value (price * quantity) - optional, can be calculated */
  total?: number;
}

/**
 * Normalized order book structure
 */
export interface OrderBook {
  /** Exchange identifier */
  exchange: string;
  /** Trading pair symbol (e.g., "BTC/USDT") */
  symbol: string;
  /** Array of bid orders (buy orders), sorted by price descending */
  bids: OrderBookEntry[];
  /** Array of ask orders (sell orders), sorted by price ascending */
  asks: OrderBookEntry[];
  /** Timestamp when this snapshot was received */
  timestamp: number;
  /** Sequence number for ordering updates (if provided by exchange) */
  sequenceId?: number;
}

/**
 * Connection status for exchange connectors
 */
export enum ConnectionStatus {
  DISCONNECTED = "disconnected",
  CONNECTING = "connecting",
  CONNECTED = "connected",
  RECONNECTING = "reconnecting",
  ERROR = "error",
}

/**
 * Event types emitted by connectors
 */
export enum ConnectorEventType {
  ORDER_BOOK_UPDATE = "orderBookUpdate",
  STATUS_CHANGE = "statusChange",
  ERROR = "error",
}

/**
 * Order book update event
 */
export interface OrderBookUpdateEvent {
  type: ConnectorEventType.ORDER_BOOK_UPDATE;
  data: OrderBook;
}

/**
 * Status change event
 */
export interface StatusChangeEvent {
  type: ConnectorEventType.STATUS_CHANGE;
  status: ConnectionStatus;
  exchange: string;
  message?: string;
}

/**
 * Error event
 */
export interface ErrorEvent {
  type: ConnectorEventType.ERROR;
  exchange: string;
  error: Error;
  message: string;
}

/**
 * Union type for all connector events
 */
export type ConnectorEvent = OrderBookUpdateEvent | StatusChangeEvent | ErrorEvent;

/**
 * Event listener callback type
 */
export type EventListener<T extends ConnectorEvent = ConnectorEvent> = (event: T) => void;

/**
 * Configuration for exchange connectors
 */
export interface ConnectorConfig {
  /** Trading pair symbol in normalized format (e.g., "BTC/USDT") */
  symbol: string;
  /** Maximum depth of order book to maintain (per side) */
  depth?: number;
  /** Reconnection configuration */
  reconnect?: {
    /** Enable automatic reconnection */
    enabled: boolean;
    /** Maximum number of reconnection attempts (0 = infinite) */
    maxAttempts: number;
    /** Delay between reconnection attempts in milliseconds */
    delayMs: number;
    /** Exponential backoff multiplier */
    backoffMultiplier?: number;
  };
}

/**
 * Base interface that all exchange connectors must implement
 */
export interface IExchangeConnector {
  /** Exchange identifier (e.g., "binance", "foxbit") */
  readonly exchange: string;

  /** Current connection status */
  readonly status: ConnectionStatus;

  /** Current order book snapshot (null if not connected) */
  readonly orderBook: OrderBook | null;

  /**
   * Connect to the exchange WebSocket
   * @returns Promise that resolves when connected
   */
  connect(): Promise<void>;

  /**
   * Disconnect from the exchange WebSocket
   */
  disconnect(): void;

  /**
   * Subscribe to connector events
   * @param listener Event listener callback
   * @returns Unsubscribe function
   */
  on(listener: EventListener): () => void;

  /**
   * Update configuration (e.g., change symbol or depth)
   * Will reconnect if already connected
   */
  updateConfig(config: Partial<ConnectorConfig>): void;
}

/**
 * Helper function to normalize symbol format across exchanges
 * Converts exchange-specific symbols to a standard format
 */
export function normalizeSymbol(
  symbol: string,
  fromFormat: "standard" | "binance" | "foxbit" | "mercadobitcoin",
): string {
  // Remove separators and convert to uppercase
  const clean = symbol.replace(/[/-_]/g, "").toUpperCase();

  if (fromFormat === "standard") {
    return symbol; // Already in standard format (e.g., "BTC/USDT")
  }

  // For now, we'll implement Binance format
  // Add other exchange formats as needed
  if (fromFormat === "binance") {
    // Binance uses format like "BTCUSDT"
    // Convert to "BTC/USDT"
    // This is a simplified version - in production, use a proper mapping
    const commonPairs: Record<string, string> = {
      BTCUSDT: "BTC/USDT",
      ETHUSDT: "ETH/USDT",
      BNBUSDT: "BNB/USDT",
      // Add more as needed
    };

    return commonPairs[clean] || symbol;
  }

  return symbol;
}

/**
 * Helper function to convert standard symbol to exchange-specific format
 */
export function toExchangeSymbol(
  symbol: string,
  toFormat: "binance" | "foxbit" | "mercadobitcoin",
): string {
  // Remove separators
  const clean = symbol.replace(/[/-_]/g, "").toUpperCase();

  if (toFormat === "binance") {
    // Binance uses format like "BTCUSDT" (no separator)
    return clean.toLowerCase();
  }

  // Add other exchange formats as needed
  return clean;
}

/**
 * Helper function to trim order book depth
 */
export function trimOrderBook(orderBook: OrderBook, maxDepth: number): OrderBook {
  return {
    ...orderBook,
    bids: orderBook.bids.slice(0, maxDepth),
    asks: orderBook.asks.slice(0, maxDepth),
  };
}

/**
 * Helper function to validate order book data
 */
export function isValidOrderBook(orderBook: OrderBook): boolean {
  return (
    orderBook.exchange !== "" &&
    orderBook.symbol !== "" &&
    Array.isArray(orderBook.bids) &&
    Array.isArray(orderBook.asks) &&
    orderBook.timestamp > 0
  );
}
