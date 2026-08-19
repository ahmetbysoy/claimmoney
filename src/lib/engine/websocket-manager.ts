export interface WSStats {
  messagesReceived: number;
  reconnects: number;
  uptime: number;
}

export interface WSConfig {
  heartbeatIntervalMs: number;
  watchdogTimeoutMs: number;
  maxReconnectAttempts: number;
}

type MessageCallback = (data: unknown) => void;

type ReconnectCallback = () => void;

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private url = '';
  private messageCallbacks: MessageCallback[] = [];
  private reconnectCallbacks: ReconnectCallback[] = [];
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private watchdogTimer: ReturnType<typeof setTimeout> | null = null;
  private connectedAt = 0;
  private reconnectCount = 0;
  private messageCount = 0;
  private config: WSConfig;
  private intentionalClose = false;

  constructor(config?: Partial<WSConfig>) {
    this.config = {
      heartbeatIntervalMs: 30000,
      watchdogTimeoutMs: 60000,
      maxReconnectAttempts: 5,
      ...config,
    };
  }

  connect(url: string): Promise<void> {
    this.url = url;
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(url);
        this.intentionalClose = false;

        this.ws.onopen = () => {
          this.connectedAt = Date.now();
          this.reconnectCount = 0;
          this.startHeartbeat();
          this.resetWatchdog();
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.messageCount++;
          this.resetWatchdog();
          const data = JSON.parse(event.data as string);
          this.messageCallbacks.forEach((cb) => cb(data));
        };

        this.ws.onerror = (err) => {
          reject(new Error(`WebSocket error: ${String(err)}`));
        };

        this.ws.onclose = () => {
          this.stopHeartbeat();
          this.clearWatchdog();
          if (!this.intentionalClose && this.reconnectCount < this.config.maxReconnectAttempts) {
            this.attemptReconnect();
          }
        };
      } catch (e) {
        reject(e);
      }
    });
  }

  disconnect(): void {
    this.intentionalClose = true;
    this.stopHeartbeat();
    this.clearWatchdog();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  send(data: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  onMessage(cb: MessageCallback): void {
    this.messageCallbacks.push(cb);
  }

  onReconnect(cb: ReconnectCallback): void {
    this.reconnectCallbacks.push(cb);
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  getStats(): WSStats {
    return {
      messagesReceived: this.messageCount,
      reconnects: this.reconnectCount,
      uptime: this.connectedAt > 0 ? Date.now() - this.connectedAt : 0,
    };
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.send({ op: 'ping' });
    }, this.config.heartbeatIntervalMs);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private resetWatchdog(): void {
    this.clearWatchdog();
    this.watchdogTimer = setTimeout(() => {
      if (this.ws) {
        this.ws.close();
      }
    }, this.config.watchdogTimeoutMs);
  }

  private clearWatchdog(): void {
    if (this.watchdogTimer) {
      clearTimeout(this.watchdogTimer);
      this.watchdogTimer = null;
    }
  }

  private attemptReconnect(): void {
    this.reconnectCount++;
    this.reconnectCallbacks.forEach((cb) => cb());
    setTimeout(() => {
      if (this.url && !this.intentionalClose) {
        this.connect(this.url).catch(() => {});
      }
    }, 1000 * this.reconnectCount);
  }
}
