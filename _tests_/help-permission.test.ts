import { describe, it, expect, vi } from 'vitest';
import helpCmd from '../src/Commands/help';
import { defineCommand } from '../src/Types/types';

describe('help command permission filtering', () => {
  it('hides commands the caller cannot run when tags are present', async () => {
    const mockChatManager: any = {
      sendMessage: vi.fn(async () => { }),
    };

    // command visible only to mods
    const modOnly = defineCommand({
      name: 'modcmd',
      permission: 'mod',
      execute: async () => { },
    });

    // command visible to everyone
    const everyone = defineCommand({
      name: 'public',
      permission: 'everyone',
      execute: async () => { },
    });

    const map = new Map<string, any>();
    map.set('modcmd', modOnly);
    map.set('public', everyone);

    // Non-mod caller tags
    const nonModTags = {
      badges: '',
      'badge-info': '',
      mod: false,
      subscriber: false,
    } as any;

    await helpCmd.execute({
      channel: '#room',
      chatManager: mockChatManager,
      commands: map,
      // provide tags so help filters
      tags: nonModTags,
    } as any);

    // Expect chatManager.sendMessage called once with only the public command listed
    expect(mockChatManager.sendMessage).toHaveBeenCalledTimes(1);
    const sent = mockChatManager.sendMessage.mock.calls[0][1] as string;
    expect(sent).toContain('!public');
    expect(sent).not.toContain('!modcmd');
  });
});
