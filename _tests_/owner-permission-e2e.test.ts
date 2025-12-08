import { describe, it, expect, vi } from 'vitest';
import { handleMessage } from '../src/Commands/dispatcher';

describe('owner permission E2E', () => {
  it('allows OWNER_USER_ID to run owner-only command', async () => {
    const commands = new Map<string, any>();

    // create an owner-only command
    const ownerCmd = {
      name: 'ownercmd',
      permission: 'owner',
      async execute(ctx: any) {
        try {
          ctx.chatManager.sendMessage(ctx.channel, 'owner ok');
        } catch { }
      },
    };
    commands.set('ownercmd', ownerCmd);

    const mockChatManager: any = {
      sendMessage: vi.fn(),
      setChannelPrivilege: vi.fn(),
      __commands: commands,
      __commandLastUsed: new Map<string, number>(),
    };

    // Simulate owner message (user-id equals OWNER_USER_ID)
    const ownerId = '5555';
    process.env.OWNER_USER_ID = ownerId;

    const ownerMsg: any = {
      channel: '#chan',
      tags: { 'user-id': ownerId, badges: '' },
      text: '!ownercmd',
    };

    await handleMessage(ownerMsg, mockChatManager, console as any);
    expect(mockChatManager.sendMessage).toHaveBeenCalledWith('#chan', 'owner ok');
  });
});
