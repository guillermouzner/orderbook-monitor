"use client";

import {useEffect, useState} from "react";
import {EXCHANGE_FEES} from "@/components/orderbook/trading-calculator";

const LOCAL_STORAGE_KEY = "custom-exchange-fees";

/**
 * Hook to manage exchange fees with localStorage persistence
 */
export function useExchangeFees() {
  const [fees, setFees] = useState<Record<string, number>>(EXCHANGE_FEES);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasCustomFees, setHasCustomFees] = useState(false);

  // Load fees from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        const customFees = JSON.parse(stored);
        setFees(customFees);
        setHasCustomFees(true);
      }
    } catch (error) {
      console.error("Error loading custom fees from localStorage:", error);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Update fees and save to localStorage
  const updateFee = (exchange: string, fee: number) => {
    const newFees = {...fees, [exchange]: fee};
    setFees(newFees);
    setHasCustomFees(true);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newFees));
    } catch (error) {
      console.error("Error saving custom fees to localStorage:", error);
    }
  };

  // Reset fees to defaults
  const resetFees = () => {
    setFees(EXCHANGE_FEES);
    setHasCustomFees(false);
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    } catch (error) {
      console.error("Error removing custom fees from localStorage:", error);
    }
  };

  return {
    fees,
    updateFee,
    resetFees,
    isLoaded,
    hasCustomFees,
  };
}
