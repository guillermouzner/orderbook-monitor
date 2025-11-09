/**
 * Exchange connectors module
 *
 * This module exports all exchange connectors and shared types.
 * To add a new exchange:
 * 1. Create a new connector file (e.g., foxbit-connector.ts)
 * 2. Implement the IExchangeConnector interface
 * 3. Export it from this file
 */

export * from "./types";

export {BinanceConnector} from "./binance-connector";
export {FoxbitConnector} from "./foxbit-connector";
export {MercadoBitcoinConnector} from "./mercadobitcoin-connector";
