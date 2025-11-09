import {ModeToggle} from "@/components/mode-toggle";
import {OrderBookProvider, OrderBookViewer} from "@/components/orderbook";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col gap-4 py-8">
      <div className="flex justify-end">
        <ModeToggle />
      </div>

      <OrderBookProvider autoConnect={true} depth={100} symbol="USDT/BRL">
        <OrderBookViewer maxRows={10} />
      </OrderBookProvider>
    </main>
  );
}
