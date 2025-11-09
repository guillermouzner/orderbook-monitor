"use client";

/**
 * Connection Status Component
 *
 * Displays connection status for all exchanges with visual indicators
 */

import {ConnectionStatus} from "@/lib/exchanges/types";
import {type ManagerStatus} from "@/lib/orderbook-manager";

interface ConnectionStatusProps {
  status: ManagerStatus;
}

/**
 * Get status color classes
 */
function getStatusColor(status: ConnectionStatus): string {
  switch (status) {
    case ConnectionStatus.CONNECTED:
      return "bg-green-500";
    case ConnectionStatus.CONNECTING:
    case ConnectionStatus.RECONNECTING:
      return "bg-yellow-500";
    case ConnectionStatus.ERROR:
      return "bg-red-500";
    case ConnectionStatus.DISCONNECTED:
    default:
      return "bg-gray-500";
  }
}

/**
 * Get status text
 */
function getStatusText(status: ConnectionStatus): string {
  switch (status) {
    case ConnectionStatus.CONNECTED:
      return "Connected";
    case ConnectionStatus.CONNECTING:
      return "Connecting";
    case ConnectionStatus.RECONNECTING:
      return "Reconnecting";
    case ConnectionStatus.ERROR:
      return "Error";
    case ConnectionStatus.DISCONNECTED:
    default:
      return "Disconnected";
  }
}

/**
 * ConnectionStatus displays the current status of all exchange connections
 */
export function ConnectionStatusIndicator({status}: ConnectionStatusProps) {
  const {connectedCount, connectingCount, disconnectedCount, errorCount, byExchange} = status;
  const totalExchanges = byExchange.size;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-xs">
          {connectedCount} / {totalExchanges} connected
        </span>
      </div>

      {/* Overall status bar */}
      <div className="bg-muted flex gap-1 overflow-hidden rounded-full">
        {connectedCount > 0 && (
          <div
            className="h-1.5 bg-green-500"
            style={{width: `${(connectedCount / totalExchanges) * 100}%`}}
            title={`${connectedCount} connected`}
          />
        )}
        {connectingCount > 0 && (
          <div
            className="h-1.5 bg-yellow-500"
            style={{width: `${(connectingCount / totalExchanges) * 100}%`}}
            title={`${connectingCount} connecting`}
          />
        )}
        {errorCount > 0 && (
          <div
            className="h-1.5 bg-red-500"
            style={{width: `${(errorCount / totalExchanges) * 100}%`}}
            title={`${errorCount} error`}
          />
        )}
        {disconnectedCount > 0 && (
          <div
            className="h-1.5 bg-gray-500"
            style={{width: `${(disconnectedCount / totalExchanges) * 100}%`}}
            title={`${disconnectedCount} disconnected`}
          />
        )}
      </div>

      {/* Individual exchange status */}
      <div className="space-y-1">
        {Array.from(byExchange.entries()).map(([exchange, exchangeStatus]) => (
          <div key={exchange} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <div
                className={`h-1.5 w-1.5 rounded-full ${getStatusColor(exchangeStatus)}`}
                title={getStatusText(exchangeStatus)}
              />
              <span className="capitalize">{exchange}</span>
            </div>
            <span className="text-muted-foreground">{getStatusText(exchangeStatus)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
