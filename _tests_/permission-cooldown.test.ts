import { describe, it, expect, vi } from 'vitest';
import { handleMessage } from '../src/Commands/dispatcher';

describe('permission and cooldown interaction', () => {
  it('denied attempts do not set cooldown; allowed attempts do', async () => {
    const cmd = {
      name: 'testcd',
      permission: 'mod',
      cooldownMs: 1000,
      async execute(ctx: any) { ctx.chatManager.sendMessage(ctx.channel, 'done'); },
    };

    const commands = new Map<string, any>([['testcd', cmd]]);
    const lastUsed = new Map<string, number>();

    const mockChatManager: any = {
      sendMessage: vi.fn(),
      setChannelPrivilege: vi.fn(),
      __commands: commands,
      __commandLastUsed: lastUsed,
    };

    // Non-mod attempt: should be denied and lastUsed not set
    const noneMsg: any = { channel: '#y', tags: { badges: '', 'user-id': '99' }, text: '!testcd' };
    await handleMessage(noneMsg, mockChatManager, console as any);
    expect(mockChatManager.sendMessage).toHaveBeenCalledWith('#y', '@unknown you don\'t have permission to use that command.');
    expect(lastUsed.has('testcd')).toBe(false);

    (mockChatManager.sendMessage as any).mockClear();

    // Mod attempt: should be allowed and lastUsed set
    const modMsg: any = { channel: '#y', tags: { badges: 'moderator/1', 'user-id': '100' }, text: '!testcd' };
    await handleMessage(modMsg, mockChatManager, console as any);
    expect(mockChatManager.sendMessage).toHaveBeenCalledWith('#y', 'done');
    expect(lastUsed.has('testcd')).toBe(true);
  });
});
