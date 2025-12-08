// Central command types and helpers to improve editor autocomplete
export const PERMISSIONS = ['owner', 'broadcaster', 'mod', 'vip', 'subscriber', 'everyone'] as const;
export type Permission = typeof PERMISSIONS[number];

export interface ChatTags {
  badges?: string;
  'user-id'?: string;
  'room-id'?: string;
  mod?: string | boolean;
  subscriber?: string | boolean;
  'display-name'?: string;
  login?: string;
  [key: string]: unknown;
}

export interface ChatManager {
  setChannelPrivilege?: (channel: string, privileged: boolean) => void;
  sendMessage?: (channel: string, text: string) => Promise<void> | void;
  // internal command registry used by the loader/manager
  __commands?: Map<string, Command>;
  __commandLastUsed?: Map<string, number>;
  [key: string]: unknown;
}

export interface CommandContext {
  channel: string;
  args: string[];
  chatManager: ChatManager;
  display?: string;
  text?: string;
  raw?: unknown;
  tags?: ChatTags;
  logger?: { info?: (...args: unknown[]) => void; warn?: (...args: unknown[]) => void; debug?: (...args: unknown[]) => void };
  commands?: Map<string, Command>;
}

export interface Command {
  name: string;
  description?: string;
  aliases?: string[];
  cooldownMs?: number;
  // permission can be a single Permission or an array of them
  permission?: Permission | Permission[];
  execute: (ctx: CommandContext) => Promise<void> | void;
}

// Helper to define commands with proper typing so editors can infer and
// offer autocompletion for `permission` and other fields.
export function defineCommand<T extends Command>(c: T): T {
  return c;
}
