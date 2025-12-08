import { describe, it, expect, vi } from 'vitest';
import { handleMessage } from '../src/Commands/dispatcher';

describe('array-permission E2E', () => {
  it('allows either vip or mod for array permission', async () => {
    const cmd = {
      name: 'vipmod',
      permission: ['vip', 'mod'],
      async execute(ctx: any) { ctx.chatManager.sendMessage(ctx.channel, 'ok'); },
    };

    const commands = new Map<string, any>([['vipmod', cmd]]);

    const mockChatManager: any = {
      sendMessage: vi.fn(),
      setChannelPrivilege: vi.fn(),
      __commands: commands,
      __commandLastUsed: new Map<string, number>(),
    };

    // vip user
    const vipMsg: any = { channel: '#c', tags: { badges: 'vip/1', 'user-id': '10' }, text: '!vipmod' };
    await handleMessage(vipMsg, mockChatManager, console as any);
    expect(mockChatManager.sendMessage).toHaveBeenCalledWith('#c', 'ok');

    (mockChatManager.sendMessage as any).mockClear();

    // moderator user
    const modMsg: any = { channel: '#c', tags: { badges: 'moderator/1', 'user-id': '11' }, text: '!vipmod' };
    await handleMessage(modMsg, mockChatManager, console as any);
    expect(mockChatManager.sendMessage).toHaveBeenCalledWith('#c', 'ok');

    (mockChatManager.sendMessage as any).mockClear();

    // neither vip nor mod
    const noneMsg: any = { channel: '#c', tags: { badges: '', 'user-id': '12' }, text: '!vipmod' };
    await handleMessage(noneMsg, mockChatManager, console as any);
    expect(mockChatManager.sendMessage).toHaveBeenCalledWith('#c', '@unknown you don\'t have permission to use that command.');
  });
});
