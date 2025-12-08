import { describe, it, expect, vi } from 'vitest';
import pingCmd from '../src/Commands/ping';
import { handleMessage } from '../src/Commands/dispatcher';

describe('dispatcher handleMessage E2E', () => {
  it('denies non-mod and allows mod to run !ping', async () => {
    const commands = new Map<string, any>();
    commands.set('ping', pingCmd);

    const mockChatManager: any = {
      sendMessage: vi.fn(),
      setChannelPrivilege: vi.fn(),
      __commands: commands,
      __commandLastUsed: new Map<string, number>(),
    };

    // Non-mod message
    const nonModMsg: any = {
      channel: '#chan',
      tags: { 'user-id': '999', badges: '' },
      text: '!ping',
    };

    await handleMessage(nonModMsg, mockChatManager, console as any);
    expect(mockChatManager.sendMessage).toHaveBeenCalledWith('#chan', '@unknown you don\'t have permission to use that command.');

    // Clear mock and reset cooldown tracking so mod can run the command immediately
    (mockChatManager.sendMessage as any).mockClear();
    mockChatManager.__commandLastUsed.delete('ping');
    // Mod message
    const modMsg: any = {
      channel: '#chan',
      tags: { 'user-id': '1', badges: 'moderator/1' },
      text: '!ping',
    };

    await handleMessage(modMsg, mockChatManager, console as any);
    expect(mockChatManager.sendMessage).toHaveBeenCalledWith('#chan', 'pong!');
  });
});
