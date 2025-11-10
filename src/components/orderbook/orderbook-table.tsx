"use client";

/**
 * OrderBook Table Component
 *
 * Displays order book data (bids and asks) for a specific exchange
 */

import {type OrderBook} from "@/lib/exchanges/types";

interface OrderBookTableProps {
  orderBook: OrderBook;
  maxRows?: number;
}

/**
 * Format number with thousands separators and fixed decimals
 */
function formatNumber(num: number, decimals: number = 2): string {
  return num.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format price based on value
 */
function formatPrice(price: number): string {
  if (price >= 1000) {
    return formatNumber(price, 2);
  } else if (price >= 1) {
    return formatNumber(price, 4);
  } else {
    return formatNumber(price, 8);
  }
}

/**
 * OrderBookTable displays bids and asks side-by-side
 */
export function OrderBookTable({orderBook, maxRows = 10}: OrderBookTableProps) {
  const {exchange, symbol, bids, asks} = orderBook;

  // Limit rows to display
  const displayBids = bids.slice(0, maxRows);
  const displayAsks = asks.slice(0, maxRows);

  return (
    <div className="flex flex-col gap-2">
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-2">
        <h3 className="text-lg font-semibold capitalize">{exchange}</h3>
        <span className="text-muted-foreground text-sm">{symbol}</span>
      </div>

      {/* Order book grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Bids (Buy orders) - Quantity | Price */}
        <div className="flex flex-col">
          <div className="space-y-1">
            {/* Header */}
            <div className="text-muted-foreground grid grid-cols-2 gap-2 text-xs font-medium">
              <div className="text-left">Quantity</div>
              <div className="text-right">Price</div>
            </div>

            {/* Bid rows */}
            {displayBids.map((bid, index) => (
              <div
                key={`bid-${index}`}
                className="grid grid-cols-2 gap-2 rounded bg-green-50 px-2 py-1 text-xs dark:bg-green-950/20"
              >
                <div className="text-left font-mono">{formatNumber(bid.quantity, 4)}</div>
                <div className="text-right font-mono text-green-700 dark:text-green-400">
                  {formatPrice(bid.price)}
                </div>
              </div>
            ))}

            {displayBids.length === 0 && (
              <div className="text-muted-foreground py-4 text-center text-sm">
                No bids available
              </div>
            )}
          </div>
        </div>

        {/* Asks (Sell orders) - Price | Quantity */}
        <div className="flex flex-col">
          <div className="space-y-1">
            {/* Header */}
            <div className="text-muted-foreground grid grid-cols-2 gap-2 text-xs font-medium">
              <div className="text-left">Price</div>
              <div className="text-right">Quantity</div>
            </div>

            {/* Ask rows */}
            {displayAsks.map((ask, index) => (
              <div
                key={`ask-${index}`}
                className="grid grid-cols-2 gap-2 rounded bg-red-50 px-2 py-1 text-xs dark:bg-red-950/20"
              >
                <div className="text-left font-mono text-red-700 dark:text-red-400">
                  {formatPrice(ask.price)}
                </div>
                <div className="text-right font-mono">{formatNumber(ask.quantity, 4)}</div>
              </div>
            ))}

            {displayAsks.length === 0 && (
              <div className="text-muted-foreground py-4 text-center text-sm">
                No asks available
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer with timestamp */}
      <div className="text-muted-foreground border-t pt-2 text-xs">
        Last update: {new Date(orderBook.timestamp).toLocaleTimeString()}
      </div>
    </div>
  );
}
