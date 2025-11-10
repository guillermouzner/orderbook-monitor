/* eslint-disable @typescript-eslint/no-misused-promises */
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
import {TradingCalculator} from "./trading-calculator";
import {ExchangeFees} from "./exchange-fees";

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
      {/* Sidebar - 1/4 de la pantalla */}
      <div className="flex w-1/4 flex-col gap-4">
        {/* Trading Calculator - Principal */}
        <TradingCalculator orderBook={orderBook} />

        {/* Errors display */}
        {errors.length > 0 && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/20">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-red-800 dark:text-red-400">
                Errors ({errors.length})
              </h3>
              <Button
                className="h-auto p-1 text-xs"
                size="sm"
                variant="ghost"
                onClick={clearErrors}
              >
                Clear
              </Button>
            </div>
            <div className="space-y-1">
              {errors.slice(0, 5).map((error, index) => (
                <div
                  key={`error-${(index * Math.random()).toString()}`}
                  className="text-xs text-red-700 dark:text-red-400"
                >
                  [{error.exchange}] {error.message}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Spacer para empujar el status hacia abajo */}
        <div className="flex-1" />

        {/* Exchange Fees */}
        <div className="bg-card rounded-lg border p-3">
          <ExchangeFees />
        </div>

        {/* Status indicator - Footer */}
        {status && (
          <div className="bg-card rounded-lg border p-3">
            <ConnectionStatusIndicator status={status} />
          </div>
        )}
      </div>

      {/* Main content - 3/4 de la pantalla con orderbooks */}
      <div className="flex w-3/4 flex-col">
        {/* Order books grid - 2 columnas por fila */}
        {hasOrderBooks ? (
          <div className="grid grid-cols-3 gap-4">
            {Array.from(orderBook.byExchange.values()).map((exchangeOrderBook) => (
              <div
                key={exchangeOrderBook.exchange}
                className="bg-card max-h-[272px] min-w-[296px] rounded-lg border"
                // style={{width: "296px", height: "272px"}}
              >
                <OrderBookTable maxRows={maxRows} orderBook={exchangeOrderBook} />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed">
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
