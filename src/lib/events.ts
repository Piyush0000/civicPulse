import { EventEmitter } from "node:events";
import { config } from "./config";

// Live Pulse event bus. Locally: in-process emitter streamed over SSE. When Supabase is configured,
// events are also broadcast over Supabase Realtime so every serverless instance and browser sees them.

export type PulseEvent =
  | {
      type: "request";
      region: string;
      id: string;
      tracking: string;
      category: string;
      urgency: string;
      language: string;
      channel: string;
      summary: string;
      lat: number | null;
      lng: number | null;
      h3: string | null;
      at: string;
    }
  | { type: "scores"; region: string; at: string }
  | { type: "decision"; region: string; id: string; status: string; title: string; at: string }
  | { type: "pipeline"; region: string; id: string; tracking: string; step: string; at: string };

type G = { __cpBus?: EventEmitter };
const g = globalThis as unknown as G;
export const bus: EventEmitter = g.__cpBus ?? (g.__cpBus = new EventEmitter().setMaxListeners(500));

export async function publish(ev: PulseEvent): Promise<void> {
  bus.emit("pulse", ev);
  if (config.supabaseUrl && config.supabaseAnonKey) {
    try {
      await fetch(`${config.supabaseUrl}/realtime/v1/api/broadcast`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          apikey: config.supabaseAnonKey,
          authorization: `Bearer ${config.supabaseAnonKey}`,
        },
        body: JSON.stringify({ messages: [{ topic: "civicpulse", event: "pulse", payload: ev }] }),
        signal: AbortSignal.timeout(3000),
      });
    } catch {
      /* realtime is best-effort */
    }
  }
}
