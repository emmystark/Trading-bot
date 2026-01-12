import { useEffect, useRef, useState, useCallback } from 'react';

export interface WebhookData {
  timestamp: number;
  balance?: {
    amount: string;
    currency: string;
    network: string;
  };
  coin?: {
    id: string;
    name: string;
    symbol: string;
    current_price: number;
    price_change_percentage_24h: number;
    market_cap: number;
    total_volume: number;
  };
  price?: {
    current: number;
    change_24h: number;
    market_cap: number;
    updated_at: string;
  };
  chart?: {
    prices: Array<{ time: string; price: number }>;
  };
  aiSignal?: {
    signal: string;
    confidence: number;
    positionSize: number;
  };
  analysis?: {
    signal: string;
    confidence: number;
    reasoning: string;
    positionSize: number;
    sentiment?: number;
  };
  trades?: Array<{
    id: string;
    asset: string;
    entry: string;
    exit: string | null;
    pnl: number;
    status: 'Active' | 'Closed';
    timestamp: string;
  }>;
}

export interface UseWebhookOptions {
  url: string;
  onData?: (data: WebhookData) => void;
  onError?: (error: Error) => void;
  onConnect?: () => void;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

/**
 * Custom hook for managing EventSource connections and receiving live webhook data
 */
export function useWebhook({
  url,
  onData,
  onError,
  onConnect,
  reconnectInterval = 3000,
  maxReconnectAttempts = 10
}: UseWebhookOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<WebhookData | null>(null);
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      return; // Already connected
    }

    try {
      const eventSource = new EventSource(url);

      eventSource.addEventListener('connected', (e: Event) => {
        const event = e as MessageEvent;
        console.log('Webhook connected:', event.data);
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;
        onConnect?.();
      });

      eventSource.addEventListener('error', (e: Event) => {
        const event = e as MessageEvent;
        console.error('Webhook error event:', event.data);
        if (event.data) {
          const errorData = JSON.parse(event.data);
          const err = new Error(errorData.error || 'Webhook error');
          setError(err);
          onError?.(err);
        }
      });

      eventSource.onmessage = (e: MessageEvent) => {
        try {
          const parsed = JSON.parse(e.data);
          if (parsed.data) {
            setData(parsed.data);
            onData?.(parsed.data);
          } else if (typeof parsed === 'object') {
            setData(parsed);
            onData?.(parsed);
          }
        } catch (err) {
          console.error('Failed to parse webhook data:', err, e.data);
        }
      };

      eventSource.onerror = () => {
        console.error('EventSource error, attempting to reconnect...');
        eventSourceRef.current = null;
        setIsConnected(false);

        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current += 1;
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log(
              `Reconnecting... (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`
            );
            connect();
          }, reconnectInterval);
        } else {
          const err = new Error('Max reconnect attempts reached');
          setError(err);
          onError?.(err);
        }
      };

      eventSourceRef.current = eventSource;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onError?.(error);
    }
  }, [url, onData, onError, onConnect, reconnectInterval, maxReconnectAttempts]);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    setIsConnected(false);
  }, []);

  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected,
    error,
    data,
    reconnect: connect,
    disconnect
  };
}
