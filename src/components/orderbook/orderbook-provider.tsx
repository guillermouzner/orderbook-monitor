"use client";

/**
 * OrderBook Context Provider
 *
 * This client component provides order book data and management functionality
 * to the React component tree using React Context.
 */

import {createContext, use, useEffect, useState, useCallback, type ReactNode} from "react";

import {
  OrderBookManager,
  type ConsolidatedOrderBook,
  type ManagerStatus,
} from "@/lib/orderbook-manager";
import {BinanceConnector, FoxbitConnector, MercadoBitcoinConnector} from "@/lib/exchanges";

/**
 * Context value interface
 */
interface OrderBookContextValue {
  /** Consolidated order book data from all exchanges */
  orderBook: ConsolidatedOrderBook | null;
  /** Manager status information */
  status: ManagerStatus | null;
  /** Whether the manager is initializing */
  isInitializing: boolean;
  /** Array of error messages */
  errors: {exchange: string; message: string; timestamp: number}[];
  /** Connect to all exchanges */
  connect: () => Promise<void>;
  /** Disconnect from all exchanges */
  disconnect: () => void;
  /** Clear all errors */
  clearErrors: () => void;
}

/**
 * Create context with undefined default (will throw if used outside provider)
 */
const OrderBookContext = createContext<OrderBookContextValue | undefined>(undefined);

/**
 * Provider props
 */
interface OrderBookProviderProps {
  children: ReactNode;
  /** Trading pair symbol (default: BTC/USDT) */
  symbol?: string;
  /** Order book depth per side (default: 20) */
  depth?: number;
  /** Auto-connect on mount (default: true) */
  autoConnect?: boolean;
}

/**
 * OrderBookProvider manages the order book manager lifecycle and provides
 * data to child components via React Context.
 */
export function OrderBookProvider({
  children,
  symbol = "USDT/BRL",
  depth = 20,
  autoConnect = true,
}: OrderBookProviderProps) {
  // State
  const [manager] = useState(() => new OrderBookManager({debounceMs: 100}));
  const [orderBook, setOrderBook] = useState<ConsolidatedOrderBook | null>(null);
  const [status, setStatus] = useState<ManagerStatus | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [errors, setErrors] = useState<{exchange: string; message: string; timestamp: number}[]>(
    [],
  );

  // Connect to all exchanges
  const connect = useCallback(async () => {
    try {
      await manager.connectAll();
    } catch (error) {
      console.error("Failed to connect:", error);
    }
  }, [manager]);

  // Disconnect from all exchanges
  const disconnect = useCallback(() => {
    manager.disconnectAll();
  }, [manager]);

  // Clear errors
  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  // Initialize manager and register connectors
  useEffect(() => {
    console.log("[OrderBookProvider] Initializing with symbol:", symbol);

    // Register Binance connector
    const binanceConnector = new BinanceConnector({
      symbol, // Use the symbol prop from provider
      depth,
      reconnect: {
        enabled: true,
        maxAttempts: 5,
        delayMs: 1000,
        backoffMultiplier: 1.5,
      },
    });

    manager.registerConnector(binanceConnector);

    // Register FoxBit connector
    const foxbitConnector = new FoxbitConnector({
      symbol, // Use the same symbol prop from provider
      depth,
      reconnect: {
        enabled: true,
        maxAttempts: 5,
        delayMs: 1000,
        backoffMultiplier: 1.5,
      },
    });

    manager.registerConnector(foxbitConnector);

    // Register MercadoBitcoin connector
    const mercadoBitcoinConnector = new MercadoBitcoinConnector({
      symbol, // Use the same symbol prop from provider
      depth,
      reconnect: {
        enabled: true,
        maxAttempts: 5,
        delayMs: 1000,
        backoffMultiplier: 1.5,
      },
    });

    manager.registerConnector(mercadoBitcoinConnector);

    // Subscribe to manager events
    const unsubOrderBook = manager.onOrderBookUpdate((data) => {
      setOrderBook(data);
    });

    const unsubStatus = manager.onStatusUpdate((newStatus) => {
      setStatus(newStatus);
    });

    const unsubError = manager.onError((error) => {
      setErrors((prev) => [
        ...prev,
        {
          exchange: error.exchange,
          message: error.message,
          timestamp: Date.now(),
        },
      ]);
    });

    // Get initial status
    setStatus(manager.getStatus());
    setIsInitializing(false);

    // Auto-connect if enabled
    if (autoConnect) {
      connect();
    }

    // Cleanup on unmount
    return () => {
      console.log("[OrderBookProvider] Cleaning up...");
      unsubOrderBook();
      unsubStatus();
      unsubError();
      manager.destroy();
    };
  }, [manager, symbol, depth, autoConnect, connect]);

  // Context value
  const value: OrderBookContextValue = {
    orderBook,
    status,
    isInitializing,
    errors,
    connect,
    disconnect,
    clearErrors,
  };

  return <OrderBookContext value={value}>{children}</OrderBookContext>;
}

/**
 * Hook to access order book context
 *
 * @throws Error if used outside OrderBookProvider
 */
export function useOrderBook(): OrderBookContextValue {
  const context = use(OrderBookContext);

  if (context === undefined) {
    throw new Error("useOrderBook must be used within an OrderBookProvider");
  }

  return context;
}
