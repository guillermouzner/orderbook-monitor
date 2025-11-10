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
  return num.toLocaleString("es-AR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format price based on value
 */
function formatPrice(price: number): string {
  if (price >= 1000) {
    return formatNumber(price, 3);
  } else if (price >= 1) {
    return formatNumber(price, 3);
  } else {
    return formatNumber(price, 3);
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
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b p-2">
        <h3 className="text-lg font-semibold capitalize">{exchange}</h3>
        <span className="text-muted-foreground text-sm">{symbol}</span>
      </div>

      {/* Order book grid */}
      <div className="grid grid-cols-2 pt-2">
        {/* Bids (Buy orders) - Quantity | Price */}
        <div className="flex flex-col">
          <div className="space-y-1">
            {/* Header */}
            <div className="text-muted-foreground grid grid-cols-2 text-center text-xs font-medium">
              <div className="">Quantity</div>
              <div className="">Price</div>
            </div>

            {/* Bid rows */}
            {displayBids.map((bid, index) => (
              <div
                key={`bid-${(index * Math.random()).toString()}`}
                className="grid grid-cols-2 rounded bg-green-50 px-0 py-1 text-center text-[10px] dark:bg-green-950/20"
              >
                <div className="font-mono">{formatNumber(bid.quantity, 3)}</div>
                <div className="font-mono text-green-700 dark:text-green-400">
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
            <div className="text-muted-foreground grid grid-cols-2 text-center text-xs font-medium">
              <div className="">Price</div>
              <div className="">Quantity</div>
            </div>

            {/* Ask rows */}
            {displayAsks.map((ask, index) => (
              <div
                key={`ask-${(index * Math.random()).toString()}`}
                className="grid grid-cols-2 rounded bg-red-50 px-0 py-1 text-center text-[10px] dark:bg-red-950/20"
              >
                <div className="font-mono text-red-700 dark:text-red-400">
                  {formatPrice(ask.price)}
                </div>
                <div className="font-mono">{formatNumber(ask.quantity, 3)}</div>
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
      <div className="text-muted-foreground flex items-center border-t p-2 text-[10px]">
        Last update: {new Date(orderBook.timestamp).toLocaleTimeString()}
      </div>
    </div>
  );
}
