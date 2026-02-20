/**
 * Represents a container instance that can provide a live log stream.
 */
export interface ContainerWithLogs {
  /**
   * @returns A readable stream of container logs when supported.
   */
  logs?: () => Promise<NodeJS.ReadableStream>
}
