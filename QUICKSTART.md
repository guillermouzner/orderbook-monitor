# Quick Start Guide - Multi-Exchange Order Book

## Get Started in 30 Seconds

### 1. Install Dependencies (if needed)
```bash
pnpm install
```

### 2. Start the Development Server
```bash
pnpm dev
```

### 3. Open Your Browser
Navigate to [http://localhost:3000](http://localhost:3000)

You should see:
- ✅ Binance order book with real-time updates
- ✅ Bids (green) and Asks (red) displayed side-by-side
- ✅ Connection status indicator
- ✅ Auto-connect to Binance WebSocket

## What You'll See

```
┌──────────────────────────────────────────┐
│ Multi-Exchange Order Book           🌓   │
│ Real-time order book data...             │
├──────────────────────────────────────────┤
│ Connection Status                        │
│ 1 / 1 connected                          │
│ ● Binance - Connected                    │
├──────────────────────────────────────────┤
│ ┌────────────────┐                       │
│ │    Binance     │                       │
│ │  Bids  │  Asks │                       │
│ │ (green)│ (red) │                       │
│ │  ....  │  .... │                       │
│ └────────────────┘                       │
└──────────────────────────────────────────┘
```

## Basic Controls

- **Disconnect Button**: Manually disconnect from all exchanges
- **Connect Button**: Reconnect to exchanges
- **Dark Mode Toggle**: Top right corner (🌙/☀️)
- **Clear Errors**: Dismiss error messages

## Current Configuration

- **Exchange**: Binance (more coming soon)
- **Symbol**: BTC/USDT
- **Depth**: 20 levels per side
- **Update Rate**: 100ms
- **Auto-connect**: Enabled

## Customization

Edit `src/app/page.tsx`:

```tsx
<OrderBookProvider 
  symbol="ETH/USDT"    // Change trading pair
  depth={50}           // Increase depth
  autoConnect={false}  // Manual connect
>
  <OrderBookViewer maxRows={15} />
</OrderBookProvider>
```

## Project Structure

```
src/
├── lib/
│   ├── exchanges/           # Exchange connectors
│   │   ├── binance-connector.ts
│   │   └── types.ts
│   └── orderbook-manager.ts # Central orchestrator
└── components/
    └── orderbook/           # UI components
        ├── orderbook-provider.tsx
        ├── orderbook-viewer.tsx
        ├── orderbook-table.tsx
        └── connection-status.tsx
```

## Adding More Exchanges

Ready to add FoxBit or MercadoBitcoin? See `ORDERBOOK.md` for the complete guide!

## Troubleshooting

### No data showing?
- Check browser console for errors
- Verify internet connection
- Try clicking "Connect" button

### Connection keeps dropping?
- Check your network stability
- Look for rate limiting messages in console
- Verify WebSocket support in your browser

### Want to change the symbol?
Edit the `symbol` prop in `src/app/page.tsx`

## Next Steps

1. ✅ Verify the implementation works
2. 📖 Read `ORDERBOOK.md` for detailed documentation
3. 🔌 Add support for FoxBit exchange
4. 🔌 Add support for MercadoBitcoin exchange
5. 🎨 Customize the UI to your needs

## Support

For detailed documentation, see:
- `ORDERBOOK.md` - Complete feature documentation
- `IMPLEMENTATION_SUMMARY.md` - Technical implementation details

## Tech Stack

- **Next.js 16** - React framework
- **React 19** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **WebSocket API** - Real-time connections

---

**Happy Trading! 📈**

