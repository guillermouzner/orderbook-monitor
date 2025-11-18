"use client";

/**
 * Exchange Fees Component
 *
 * Displays and allows editing of commission rates for each exchange
 */

import {useState} from "react";
import {Button} from "@/components/ui/button";

interface ExchangeFeesProps {
  fees: Record<string, number>;
  onUpdateFee: (exchange: string, fee: number) => void;
  onResetFees: () => void;
  hasCustomFees: boolean;
}

/**
 * Format fee percentage for display
 */
function formatFeePercentage(fee: number): string {
  return `${(fee * 100).toFixed(2)}%`;
}

/**
 * ExchangeFees displays and allows editing the commission rates for all exchanges
 */
export function ExchangeFees({fees, onUpdateFee, onResetFees, hasCustomFees}: ExchangeFeesProps) {
  const [editingExchange, setEditingExchange] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const handleStartEdit = (exchange: string, currentFee: number) => {
    setEditingExchange(exchange);
    setEditValue((currentFee * 100).toFixed(2));
  };

  const handleSaveEdit = (exchange: string) => {
    const newFeePercentage = parseFloat(editValue);
    if (!isNaN(newFeePercentage) && newFeePercentage >= 0 && newFeePercentage <= 100) {
      onUpdateFee(exchange, newFeePercentage / 100);
    }
    setEditingExchange(null);
    setEditValue("");
  };

  const handleCancelEdit = () => {
    setEditingExchange(null);
    setEditValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent, exchange: string) => {
    if (e.key === "Enter") {
      handleSaveEdit(exchange);
    } else if (e.key === "Escape") {
      handleCancelEdit();
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-xs">Comisiones</span>
        {hasCustomFees && (
          <Button
            className="h-auto px-2 py-0.5 text-[10px]"
            size="sm"
            variant="ghost"
            onClick={onResetFees}
          >
            Resetear
          </Button>
        )}
      </div>

      {/* Exchange fees list */}
      <div className="space-y-1">
        {Object.entries(fees).map(([exchange, fee]) => (
          <div key={exchange} className="flex items-center justify-between gap-2 text-xs">
            <span className="capitalize">{exchange}</span>
            {editingExchange === exchange ? (
              <div className="flex items-center gap-1">
                <input
                  autoFocus
                  className="w-16 rounded border px-1 py-0.5 text-right font-mono text-[10px]"
                  type="number"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, exchange)}
                  onBlur={() => handleSaveEdit(exchange)}
                />
                <span className="text-[10px]">%</span>
              </div>
            ) : (
              <button
                className="text-muted-foreground hover:text-foreground font-mono transition-colors"
                onClick={() => handleStartEdit(exchange, fee)}
              >
                {formatFeePercentage(fee)}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
