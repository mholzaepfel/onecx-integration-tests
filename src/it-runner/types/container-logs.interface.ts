export interface ContainerWithLogs {
  logs?: () => Promise<NodeJS.ReadableStream>
}
