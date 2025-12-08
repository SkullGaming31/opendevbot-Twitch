import { describe, it, expect, vi } from 'vitest';
import { handleMessage } from '../src/Commands/dispatcher';

describe('alias permission E2E', () => {
  it('aliases inherit permission from canonical command', async () => {
    const cmd = {
      name: 'canon',
      aliases: ['alias1'],
      permission: 'mod',
      async execute(ctx: any) { ctx.chatManager.sendMessage(ctx.channel, 'alias ok'); },
    };

    // __commands map contains both canonical name and alias mapping
    const commands = new Map<string, any>([['canon', cmd], ['alias1', cmd]]);

    const mockChatManager: any = {
      sendMessage: vi.fn(),
      setChannelPrivilege: vi.fn(),
      __commands: commands,
      __commandLastUsed: new Map<string, number>(),
    };

    // alias invoked by mod
    const modMsg: any = { channel: '#x', tags: { badges: 'moderator/1', 'user-id': '22' }, text: '!alias1' };
    await handleMessage(modMsg, mockChatManager, console as any);
    expect(mockChatManager.sendMessage).toHaveBeenCalledWith('#x', 'alias ok');

    (mockChatManager.sendMessage as any).mockClear();

    // alias invoked by non-mod
    const noneMsg: any = { channel: '#x', tags: { badges: '', 'user-id': '23' }, text: '!alias1' };
    await handleMessage(noneMsg, mockChatManager, console as any);
    expect(mockChatManager.sendMessage).toHaveBeenCalledWith('#x', '@unknown you don\'t have permission to use that command.');
  });
});
