/** Employee APIs have their own connected store. Other HR modules remain disconnected. */
export const DATA_API_CONNECTED = false
export const DATA_CONNECTION_MESSAGE = 'Data connection pending. Records will appear when the data API is connected.'

export function requireDataConnection() {
  if (!DATA_API_CONNECTED) throw new Error(DATA_CONNECTION_MESSAGE)
}
