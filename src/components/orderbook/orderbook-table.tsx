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
      <div className="grid grid-cols-2 gap-2">
        {/* Bids (Buy orders) - Quantity | Price */}
        <div className="flex flex-col">
          <div className="space-y-0.5">
            {/* Header */}
            <div className="text-muted-foreground grid grid-cols-2 gap-1 text-[10px] font-medium">
              <div className="text-left">Quantity</div>
              <div className="text-right">Price</div>
            </div>

            {/* Bid rows */}
            {displayBids.map((bid, index) => (
              <div
                key={`bid-${index}`}
                className="grid grid-cols-2 gap-1 rounded bg-green-50 px-1.5 py-0.5 text-[10px] dark:bg-green-950/20"
              >
                <div className="text-left font-mono truncate">{formatNumber(bid.quantity, 2)}</div>
                <div className="text-right font-mono text-green-700 dark:text-green-400 truncate">
                  {formatPrice(bid.price)}
                </div>
              </div>
            ))}

            {displayBids.length === 0 && (
              <div className="text-muted-foreground py-4 text-center text-xs">
                No bids available
              </div>
            )}
          </div>
        </div>

        {/* Asks (Sell orders) - Price | Quantity */}
        <div className="flex flex-col">
          <div className="space-y-0.5">
            {/* Header */}
            <div className="text-muted-foreground grid grid-cols-2 gap-1 text-[10px] font-medium">
              <div className="text-left">Price</div>
              <div className="text-right">Quantity</div>
            </div>

            {/* Ask rows */}
            {displayAsks.map((ask, index) => (
              <div
                key={`ask-${index}`}
                className="grid grid-cols-2 gap-1 rounded bg-red-50 px-1.5 py-0.5 text-[10px] dark:bg-red-950/20"
              >
                <div className="text-left font-mono text-red-700 dark:text-red-400 truncate">
                  {formatPrice(ask.price)}
                </div>
                <div className="text-right font-mono truncate">{formatNumber(ask.quantity, 2)}</div>
              </div>
            ))}

            {displayAsks.length === 0 && (
              <div className="text-muted-foreground py-4 text-center text-xs">
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
