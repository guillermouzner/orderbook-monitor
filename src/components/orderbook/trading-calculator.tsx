"use client";

/**
 * Trading Calculator Component
 *
 * Calculates effective prices for buying/selling USDT across exchanges
 */

import {type ConsolidatedOrderBook} from "@/lib/orderbook-manager";

interface TradingCalculatorProps {
  orderBook: ConsolidatedOrderBook | null;
}

/**
 * Calculate how much BRL is needed to buy a given amount of USDT
 * Uses asks (sell orders) from the orderbook
 */
function calculateBuyPrice(
  asks: {price: number; quantity: number}[],
  usdtAmount: number
): number | null {
  let remainingUsdt = usdtAmount;
  let totalBrl = 0;

  for (const ask of asks) {
    if (remainingUsdt <= 0) break;

    const usdtToTake = Math.min(remainingUsdt, ask.quantity);
    totalBrl += usdtToTake * ask.price;
    remainingUsdt -= usdtToTake;
  }

  // If we couldn't fill the entire order, return null
  if (remainingUsdt > 0) return null;

  return totalBrl;
}

/**
 * Calculate how much BRL will be received from selling a given amount of USDT
 * Uses bids (buy orders) from the orderbook
 */
function calculateSellPrice(
  bids: {price: number; quantity: number}[],
  usdtAmount: number
): number | null {
  let remainingUsdt = usdtAmount;
  let totalBrl = 0;

  for (const bid of bids) {
    if (remainingUsdt <= 0) break;

    const usdtToSell = Math.min(remainingUsdt, bid.quantity);
    totalBrl += usdtToSell * bid.price;
    remainingUsdt -= usdtToSell;
  }

  // If we couldn't fill the entire order, return null
  if (remainingUsdt > 0) return null;

  return totalBrl;
}

/**
 * Format BRL amount
 */
function formatBrl(amount: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format USDT amount
 */
function formatUsdt(amount: number): string {
  return `${(amount / 1000).toFixed(0)}k`;
}

/**
 * TradingCalculator shows buy/sell calculations for different USDT amounts
 */
export function TradingCalculator({orderBook}: TradingCalculatorProps) {
  if (!orderBook || orderBook.byExchange.size === 0) {
    return (
      <div className="rounded-lg border bg-card p-4">
        <div className="text-muted-foreground text-center text-sm">
          No orderbook data available
        </div>
      </div>
    );
  }

  const amounts = [10000, 50000, 100000]; // 10k, 50k, 100k USDT

  return (
    <div className="flex flex-col gap-4">
      {/* Buy section */}
      <div className="rounded-lg border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold text-green-600 dark:text-green-400">
          Comprar USDT
        </h3>
        <div className="space-y-3">
          {amounts.map((amount) => (
            <div key={`buy-${amount}`}>
              <div className="mb-1 text-xs font-medium text-muted-foreground">
                {formatUsdt(amount)} USDT
              </div>
              <div className="space-y-1">
                {Array.from(orderBook.byExchange.values()).map((exchangeOb) => {
                  const price = calculateBuyPrice(exchangeOb.asks, amount);
                  return (
                    <div
                      key={`buy-${amount}-${exchangeOb.exchange}`}
                      className="flex items-center justify-between text-xs"
                    >
                      <span className="capitalize text-muted-foreground">
                        {exchangeOb.exchange}
                      </span>
                      <span className="font-mono font-medium">
                        {price ? formatBrl(price) : "N/A"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sell section */}
      <div className="rounded-lg border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold text-red-600 dark:text-red-400">
          Vender USDT
        </h3>
        <div className="space-y-3">
          {amounts.map((amount) => (
            <div key={`sell-${amount}`}>
              <div className="mb-1 text-xs font-medium text-muted-foreground">
                {formatUsdt(amount)} USDT
              </div>
              <div className="space-y-1">
                {Array.from(orderBook.byExchange.values()).map((exchangeOb) => {
                  const price = calculateSellPrice(exchangeOb.bids, amount);
                  return (
                    <div
                      key={`sell-${amount}-${exchangeOb.exchange}`}
                      className="flex items-center justify-between text-xs"
                    >
                      <span className="capitalize text-muted-foreground">
                        {exchangeOb.exchange}
                      </span>
                      <span className="font-mono font-medium">
                        {price ? formatBrl(price) : "N/A"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
