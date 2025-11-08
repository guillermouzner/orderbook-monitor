# Multi-Exchange Order Book

A real-time order book viewer that aggregates data from multiple cryptocurrency exchanges in a single interface.

## Features

- ✅ **Real-time WebSocket connections** to multiple exchanges
- ✅ **Modular architecture** for easy addition of new exchanges
- ✅ **Automatic reconnection** with exponential backoff
- ✅ **Normalized data format** across all exchanges
- ✅ **React Context API** for state management
- ✅ **TypeScript** for type safety
- ✅ **Responsive UI** with dark mode support
- ✅ **Connection status monitoring** for each exchange

## Architecture

### 1. Exchange Connectors (`src/lib/exchanges/`)

Each exchange has its own connector class that implements the `IExchangeConnector` interface:

```typescript
interface IExchangeConnector {
  readonly exchange: string;
  readonly status: ConnectionStatus;
  readonly orderBook: OrderBook | null;
  
  connect(): Promise<void>;
  disconnect(): void;
  on(listener: EventListener): () => void;
  updateConfig(config: Partial<ConnectorConfig>): void;
}
```

**Currently Implemented:**
- ✅ **Binance** (`BinanceConnector`)

**Ready for Implementation:**
- 🔜 FoxBit
- 🔜 MercadoBitcoin

### 2. Order Book Manager (`src/lib/orderbook-manager.ts`)

The central orchestrator that:
- Manages multiple exchange connectors
- Aggregates order book data
- Handles reconnection logic
- Provides a unified event system
- Debounces updates for performance

### 3. React Context & Hooks (`src/components/orderbook/`)

Client-side React integration:
- **OrderBookProvider**: Context provider that manages manager lifecycle
- **useOrderBook**: Hook to access order book data and controls
- **OrderBookViewer**: Main UI component
- **OrderBookTable**: Displays bids/asks for a single exchange
- **ConnectionStatusIndicator**: Shows connection status

## Usage

### Basic Setup

```tsx
import { OrderBookProvider, OrderBookViewer } from '@/components/orderbook';

export default function Page() {
  return (
    <OrderBookProvider 
      symbol="BTC/USDT" 
      depth={20} 
      autoConnect={true}
    >
      <OrderBookViewer maxRows={10} />
    </OrderBookProvider>
  );
}
```

### Using the Hook

```tsx
'use client';

import { useOrderBook } from '@/components/orderbook';

export function CustomComponent() {
  const { orderBook, status, connect, disconnect } = useOrderBook();
  
  // Access consolidated order book data
  const binanceOrderBook = orderBook?.byExchange.get('binance');
  
  return (
    <div>
      {/* Your custom UI */}
    </div>
  );
}
```

## Adding a New Exchange

To add support for a new exchange, follow these steps:

### 1. Create the Connector

Create a new file `src/lib/exchanges/your-exchange-connector.ts`:

```typescript
'use client';

import {
  type IExchangeConnector,
  type ConnectorConfig,
  type OrderBook,
  ConnectionStatus,
  ConnectorEventType,
} from './types';

export class YourExchangeConnector implements IExchangeConnector {
  public readonly exchange = 'yourexchange';
  
  // Implement all interface methods
  // ...
}
```

### 2. Export from Index

Add to `src/lib/exchanges/index.ts`:

```typescript
export { YourExchangeConnector } from './your-exchange-connector';
```

### 3. Register in Provider

Update `src/components/orderbook/orderbook-provider.tsx`:

```typescript
// Import your connector
import { YourExchangeConnector } from '@/lib/exchanges';

// Register in useEffect
const yourExchangeConnector = new YourExchangeConnector({
  symbol,
  depth,
  reconnect: {
    enabled: true,
    maxAttempts: 5,
    delayMs: 1000,
    backoffMultiplier: 1.5,
  },
});

manager.registerConnector(yourExchangeConnector);
```

## Configuration

### ConnectorConfig

```typescript
interface ConnectorConfig {
  symbol: string;           // Trading pair (e.g., "BTC/USDT")
  depth?: number;           // Max depth per side (default: 20)
  reconnect?: {
    enabled: boolean;       // Enable auto-reconnect
    maxAttempts: number;    // Max attempts (0 = infinite)
    delayMs: number;        // Initial delay
    backoffMultiplier?: number; // Exponential backoff (default: 1)
  };
}
```

### ManagerConfig

```typescript
interface ManagerConfig {
  debounceMs?: number;      // Debounce time for updates (default: 100ms)
}
```

## Data Flow

```
WebSocket Stream (Exchange)
    ↓
ExchangeConnector
    ↓
OrderBookManager
    ↓
React Context
    ↓
UI Components
```

## Type Definitions

### OrderBook

```typescript
interface OrderBook {
  exchange: string;         // Exchange identifier
  symbol: string;           // Trading pair
  bids: OrderBookEntry[];   // Buy orders (descending price)
  asks: OrderBookEntry[];   // Sell orders (ascending price)
  timestamp: number;        // Update timestamp
  sequenceId?: number;      // Sequence number (if available)
}
```

### OrderBookEntry

```typescript
interface OrderBookEntry {
  price: number;            // Price level
  quantity: number;         // Quantity at this price
  total?: number;           // Total value (optional)
}
```

## WebSocket Endpoints

### Binance
- **URL**: `wss://stream.binance.com:9443/ws/{symbol}@depth20@100ms`
- **Format**: `{symbol}` is lowercase without separator (e.g., `btcusdt`)
- **Update Rate**: 100ms
- **Documentation**: https://binance-docs.github.io/apidocs/spot/en/#websocket-market-streams

### Future Exchanges

Add documentation for each new exchange WebSocket endpoint here.

## Development

### Running the Dev Server

```bash
pnpm dev
```

### Building for Production

```bash
pnpm build
```

### Type Checking

```bash
pnpm tsc --noEmit
```

## Best Practices

1. **Always disconnect**: Call `disconnect()` or let the provider cleanup on unmount
2. **Handle errors**: Subscribe to error events for debugging
3. **Debounce updates**: Use manager's debounce feature for high-frequency updates
4. **Validate data**: Use helper functions like `isValidOrderBook()` before using data
5. **Type safety**: Leverage TypeScript for compile-time checks

## Troubleshooting

### WebSocket Connection Failed

- Check browser console for CORS or network errors
- Verify the exchange WebSocket URL is correct
- Ensure you're not being rate-limited

### No Data Displayed

- Check that the connector status is "connected"
- Verify the symbol format is correct for the exchange
- Look for errors in the browser console

### Memory Leaks

- Ensure `OrderBookProvider` is properly unmounted
- Don't forget to unsubscribe from event listeners
- The manager automatically cleans up on destroy

## Future Enhancements

- [ ] Add support for FoxBit exchange
- [ ] Add support for MercadoBitcoin exchange
- [ ] Implement merged order book view across all exchanges
- [ ] Add price charts/sparklines
- [ ] Add trade history stream
- [ ] Implement custom depth selection UI
- [ ] Add export/download functionality
- [ ] Performance optimizations with virtual scrolling
- [ ] Add unit tests
- [ ] Add E2E tests

## License

This implementation follows Next.js best practices and uses the MIT license.

