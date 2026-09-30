/** Mirrors `UiEntryMap` in imports-scripts, which is compiled separately into the import container. */
export type UiEntryMap = Record<string, { alias: string; port: number; entry?: string; baseUrl?: string }>
