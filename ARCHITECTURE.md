# Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser (Client)                         │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    React UI Layer                          │ │
│  │                                                            │ │
│  │  ┌──────────────────────────────────────────────────────┐ │ │
│  │  │           OrderBookViewer Component                  │ │ │
│  │  │  - Displays order books from all exchanges         │ │ │
│  │  │  - Shows connection status                         │ │ │
│  │  │  - Provides connect/disconnect controls            │ │ │
│  │  └──────────────────────────────────────────────────────┘ │ │
│  │                           ↕                               │ │
│  │  ┌──────────────────────────────────────────────────────┐ │ │
│  │  │              useOrderBook() Hook                     │ │ │
│  │  │  - Provides order book data                         │ │ │
│  │  │  - Exposes status and controls                      │ │ │
│  │  └──────────────────────────────────────────────────────┘ │ │
│  │                           ↕                               │ │
│  │  ┌──────────────────────────────────────────────────────┐ │ │
│  │  │         OrderBookProvider (Context)                  │ │ │
│  │  │  - Manages manager lifecycle                        │ │ │
│  │  │  - Subscribes to manager events                     │ │ │
│  │  │  - Updates React state                              │ │ │
│  │  └──────────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              ↕                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                  Business Logic Layer                      │ │
│  │                                                            │ │
│  │  ┌──────────────────────────────────────────────────────┐ │ │
│  │  │              OrderBookManager                        │ │ │
│  │  │  - Orchestrates multiple connectors                 │ │ │
│  │  │  - Aggregates order book data                       │ │ │
│  │  │  - Manages subscriptions                            │ │ │
│  │  │  - Debounces updates                                │ │ │
│  │  │  - Emits consolidated events                        │ │ │
│  │  └──────────────────────────────────────────────────────┘ │ │
│  │              ↕            ↕            ↕                    │ │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐         │ │
│  │  │  Binance    │ │   FoxBit    │ │MercadoBitcoin│        │ │
│  │  │ Connector   │ │ Connector   │ │  Connector  │         │ │
│  │  │             │ │   (TODO)    │ │   (TODO)    │         │ │
│  │  │ ✅ Active   │ │             │ │             │         │ │
│  │  └─────────────┘ └─────────────┘ └─────────────┘         │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              ↕                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                   WebSocket Layer                          │ │
│  │                                                            │ │
│  │     ws://stream.binance.com/ws/btcusdt@depth20@100ms      │ │
│  │     (Other exchange WebSocket endpoints)                   │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                     Exchange Servers                             │
│                                                                  │
│     Binance.com        FoxBit         MercadoBitcoin           │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Initialization Flow

```
User loads page
    ↓
HomePage renders
    ↓
OrderBookProvider mounts
    ↓
Creates OrderBookManager
    ↓
Registers BinanceConnector
    ↓
Subscribes to manager events
    ↓
Auto-connect (if enabled)
    ↓
BinanceConnector.connect()
    ↓
WebSocket connection established
```

### 2. Real-time Update Flow

```
Binance sends order book update
    ↓
WebSocket.onmessage triggered
    ↓
BinanceConnector parses message
    ↓
Normalizes to common format
    ↓
Emits ORDER_BOOK_UPDATE event
    ↓
OrderBookManager receives event
    ↓
Updates internal state
    ↓
Debounces update (100ms)
    ↓
Calls registered callbacks
    ↓
OrderBookProvider updates React state
    ↓
UI components re-render
    ↓
User sees updated prices
```

### 3. Disconnect Flow

```
User clicks "Disconnect"
    ↓
OrderBookManager.disconnectAll()
    ↓
BinanceConnector.disconnect()
    ↓
WebSocket.close()
    ↓
Emits STATUS_CHANGE event
    ↓
OrderBookProvider updates state
    ↓
UI shows disconnected status
```

## Component Hierarchy

```
page.tsx (Server Component)
└── OrderBookProvider (Client Component)
    └── OrderBookViewer (Client Component)
        ├── ConnectionStatusIndicator
        │   └── Status dots and bars
        └── OrderBookTable (per exchange)
            ├── Bids column (green)
            └── Asks column (red)
```

## Event System

### Connector Events

```typescript
// Emitted by individual connectors
ORDER_BOOK_UPDATE → { exchange, symbol, bids, asks, timestamp }
STATUS_CHANGE     → { exchange, status, message }
ERROR            → { exchange, error, message }
```

### Manager Callbacks

```typescript
// Manager aggregates and emits
onOrderBookUpdate() → ConsolidatedOrderBook
onStatusUpdate()    → ManagerStatus
onError()          → { exchange, message, error }
```

## State Management

### Manager State (JavaScript)
```typescript
{
  connectors: Map<string, IExchangeConnector>
  orderBooks: Map<string, OrderBook>
  unsubscribers: Map<string, Function>
}
```

### React State (Provider)
```typescript
{
  orderBook: ConsolidatedOrderBook | null
  status: ManagerStatus | null
  isInitializing: boolean
  errors: Array<ErrorInfo>
}
```

## Type System

### Core Types

```typescript
interface OrderBook {
  exchange: string
  symbol: string
  bids: OrderBookEntry[]
  asks: OrderBookEntry[]
  timestamp: number
  sequenceId?: number
}

interface OrderBookEntry {
  price: number
  quantity: number
  total?: number
}

interface ConsolidatedOrderBook {
  byExchange: Map<string, OrderBook>
  lastUpdate: number
  symbol: string
}
```

## Connection States

```
DISCONNECTED ──connect()──→ CONNECTING
                                ↓
                         [WebSocket open]
                                ↓
                            CONNECTED
                                ↓
                         [WebSocket close]
                                ↓
                         RECONNECTING ──→ [retry logic]
                                ↓
                         [max retries]
                                ↓
                              ERROR
```

## Performance Optimizations

### 1. Debouncing
- Updates are debounced (100ms default)
- Prevents excessive React re-renders
- Batches rapid updates from exchanges

### 2. Event System
- Set-based listener storage (O(1) operations)
- Efficient add/remove operations
- No memory leaks with cleanup

### 3. Cleanup
- Automatic WebSocket closure on unmount
- Event listener unsubscription
- Manager resource cleanup

### 4. Selective Rendering
- React Context prevents unnecessary renders
- Only consuming components re-render
- Memoization opportunities in child components

## Error Handling

### Connection Errors
```
WebSocket error
    ↓
Connector catches error
    ↓
Emits ERROR event
    ↓
Manager propagates
    ↓
Provider collects errors
    ↓
UI displays error message
    ↓
Automatic reconnection attempt
```

### Data Parsing Errors
```
Invalid message received
    ↓
Connector catches parse error
    ↓
Logs to console
    ↓
Emits ERROR event
    ↓
Connection remains open
    ↓
Next valid message processed
```

## Scalability

### Adding New Exchanges

1. **Create Connector** (`src/lib/exchanges/[exchange]-connector.ts`)
   ```typescript
   export class ExchangeConnector implements IExchangeConnector {
     // Implement interface
   }
   ```

2. **Export from Index** (`src/lib/exchanges/index.ts`)
   ```typescript
   export { ExchangeConnector } from './exchange-connector';
   ```

3. **Register in Provider** (`orderbook-provider.tsx`)
   ```typescript
   const connector = new ExchangeConnector({ symbol, depth });
   manager.registerConnector(connector);
   ```

### Supporting Multiple Symbols

Current: Single symbol per provider instance
Future: Extend manager to support multiple symbols simultaneously

### Performance at Scale

- ✅ Handles 1-3 exchanges efficiently
- ✅ Debouncing prevents render storms
- 🔄 For 10+ exchanges, consider virtual scrolling
- 🔄 For multiple symbols, consider data pagination

## Security Considerations

### Client-Side Only
- ✅ All WebSocket connections from browser
- ✅ No API keys needed (public endpoints)
- ✅ No server-side proxy required

### Data Validation
- ✅ Type checking at boundaries
- ✅ Validation helpers for order books
- ✅ Error boundaries for UI safety

## Browser Compatibility

### Required Features
- WebSocket API (all modern browsers)
- ES6+ JavaScript
- React 19 support
- CSS Grid and Flexbox

### Tested On
- ✅ Chrome/Edge (Chromium)
- ✅ Firefox
- ✅ Safari
- ⚠️ Mobile browsers (limited testing)

## Future Architecture Enhancements

### Possible Improvements
1. Virtual scrolling for large order books
2. Service Worker for offline detection
3. IndexedDB for historical data caching
4. Web Workers for data processing
5. Shared WebSocket connections across tabs
6. Real-time price charts integration
7. Trade execution interface
8. Order book depth visualization
9. Multi-symbol support
10. Performance monitoring integration

## Conclusion

The architecture is:
- ✅ **Modular**: Easy to extend with new exchanges
- ✅ **Type-safe**: Full TypeScript coverage
- ✅ **Performant**: Debounced updates, efficient events
- ✅ **Maintainable**: Clear separation of concerns
- ✅ **Scalable**: Ready for multiple exchanges
- ✅ **Robust**: Error handling and reconnection logic
- ✅ **Modern**: Following Next.js 16 best practices

