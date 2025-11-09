"use client";

/**
 * OrderBook Viewer Component
 *
 * Main component that displays order books from all connected exchanges
 */

import {Button} from "@/components/ui/button";

import {useOrderBook} from "./orderbook-provider";
import {OrderBookTable} from "./orderbook-table";
import {ConnectionStatusIndicator} from "./connection-status";

interface OrderBookViewerProps {
  /** Maximum rows to display per order book side */
  maxRows?: number;
}

/**
 * OrderBookViewer is the main UI component that displays order book data
 */
export function OrderBookViewer({maxRows = 10}: OrderBookViewerProps) {
  const {orderBook, status, isInitializing, errors, connect, disconnect, clearErrors} =
    useOrderBook();

  // Show loading state
  if (isInitializing) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="mb-2 text-lg font-semibold">Initializing...</div>
          <div className="text-muted-foreground text-sm">Setting up exchange connections</div>
        </div>
      </div>
    );
  }

  const hasConnections = status && status.connectedCount > 0;
  const hasOrderBooks = orderBook && orderBook.byExchange.size > 0;

  return (
    <div className="flex h-full gap-4">
      {/* Sidebar - 1/4 of screen */}
      <div className="flex w-1/4 flex-col gap-4">
        {/* Header */}
        <div className="rounded-lg border bg-card p-4">
          <h1 className="mb-2 text-2xl font-bold">Multi-Exchange Order Book</h1>
          <p className="text-muted-foreground mb-4 text-sm">
            Real-time order book data from multiple exchanges
          </p>

          {/* Connect/Disconnect button */}
          <div className="mb-4">
            {hasConnections ? (
              <Button className="w-full" variant="outline" onClick={disconnect}>
                Disconnect
              </Button>
            ) : (
              <Button className="w-full" onClick={connect}>
                Connect
              </Button>
            )}
          </div>

          {/* Connection Status */}
          {status && (
            <div className="space-y-3">
              <div className="border-t pt-3">
                <h3 className="mb-2 text-sm font-semibold">Connection Status</h3>
                <div className="text-muted-foreground mb-3 text-sm">
                  {status.connectedCount} / {status.connectedCount + status.connectingCount + status.disconnectedCount + status.errorCount} connected
                </div>
              </div>

              {/* Individual exchange status */}
              <div className="space-y-2">
                {Array.from(status.byExchange.entries()).map(([exchange, connectionStatus]) => (
                  <div key={exchange} className="flex items-center justify-between text-sm">
                    <span className="capitalize">{exchange}</span>
                    <span
                      className={`text-xs font-medium ${
                        connectionStatus === "connected"
                          ? "text-green-600 dark:text-green-400"
                          : connectionStatus === "connecting" || connectionStatus === "reconnecting"
                            ? "text-yellow-600 dark:text-yellow-400"
                            : connectionStatus === "error"
                              ? "text-red-600 dark:text-red-400"
                              : "text-muted-foreground"
                      }`}
                    >
                      {connectionStatus.charAt(0).toUpperCase() + connectionStatus.slice(1)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Symbol info */}
          {orderBook && (
            <div className="text-muted-foreground mt-4 border-t pt-3 text-xs">
              <div className="mb-1">Symbol: {orderBook.symbol}</div>
              <div>Last update: {new Date(orderBook.lastUpdate).toLocaleTimeString()}</div>
            </div>
          )}
        </div>

        {/* Errors display */}
        {errors.length > 0 && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/20">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-red-800 dark:text-red-400">
                Errors ({errors.length})
              </h3>
              <Button className="h-auto p-1 text-xs" size="sm" variant="ghost" onClick={clearErrors}>
                Clear
              </Button>
            </div>
            <div className="space-y-1">
              {errors.slice(0, 5).map((error, index) => (
                <div key={`error-${index}`} className="text-xs text-red-700 dark:text-red-400">
                  [{error.exchange}] {error.message}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Order books - 3/4 of screen */}
      <div className="flex-1">
        {hasOrderBooks ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from(orderBook.byExchange.values()).map((exchangeOrderBook) => (
              <div key={exchangeOrderBook.exchange} className="bg-card rounded-lg border p-4">
                <OrderBookTable maxRows={maxRows} orderBook={exchangeOrderBook} />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center rounded-lg border border-dashed">
            <div className="text-center">
              <div className="mb-2 text-lg font-semibold">No Order Book Data</div>
              <div className="text-muted-foreground mb-4 text-sm">
                {hasConnections
                  ? "Waiting for data from exchanges..."
                  : "Connect to exchanges to view order books"}
              </div>
              {!hasConnections && (
                <Button size="sm" onClick={connect}>
                  Connect Now
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
