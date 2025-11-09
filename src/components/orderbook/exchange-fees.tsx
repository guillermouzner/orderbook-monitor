"use client";

/**
 * Exchange Fees Component
 *
 * Displays commission rates for each exchange
 */

import {EXCHANGE_FEES} from "./trading-calculator";

/**
 * Format fee percentage
 */
function formatFeePercentage(fee: number): string {
  return `${(fee * 100).toFixed(2)}%`;
}

/**
 * ExchangeFees displays the commission rates for all exchanges
 */
export function ExchangeFees() {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-xs">Comisiones</span>
      </div>

      {/* Exchange fees list */}
      <div className="space-y-1">
        {Object.entries(EXCHANGE_FEES).map(([exchange, fee]) => (
          <div key={exchange} className="flex items-center justify-between text-xs">
            <span className="capitalize">{exchange}</span>
            <span className="text-muted-foreground font-mono">
              {formatFeePercentage(fee)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
