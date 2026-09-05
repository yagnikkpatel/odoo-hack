/** Only authentication is connected. Domain actions must use real APIs before this is enabled. */
export const DATA_API_CONNECTED = false
export const DATA_CONNECTION_MESSAGE = 'Data connection pending. Records will appear when the data API is connected.'

export function requireDataConnection() {
  if (!DATA_API_CONNECTED) throw new Error(DATA_CONNECTION_MESSAGE)
}
