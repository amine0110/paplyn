/** Cap y-websocket exponential reconnect delay (ms). */
export const COLLAB_WS_MAX_BACKOFF_MS = 30000;

export function collabWebsocketProviderOptions(token: string) {
  return {
    params: { token },
    maxBackoffTime: COLLAB_WS_MAX_BACKOFF_MS,
  };
}
