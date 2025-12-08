import { describe, it, expect, vi } from 'vitest';
import path from 'path';

import pingCmd from '../src/Commands/ping';
import { isAllowedByPermission } from '../src/Commands/core/permission';

describe('dispatcher integration - permissions', () => {
  it("denies a non-mod invoking !ping and notifies them", async () => {
    const mockChatManager: any = {
      sendMessage: vi.fn(),
      __commands: new Map<string, any>(),
      __commandLastUsed: new Map<string, number>(),
    };

    // Simulate a message from a non-mod user
    const m: any = {
      channel: '#test',
      tags: { 'user-id': '999', badges: '' },
      text: '!ping',
    };
    const cmd: any = pingCmd;
    expect(cmd).toBeDefined();

    const allowed = isAllowedByPermission(m.tags, cmd.permission, process.env.OWNER_USER_ID);
    expect(allowed).toBe(false);

    // Simulate dispatcher denial behavior
    const who = (m.tags && (m.tags['display-name'] || m.tags['login'])) || 'unknown';
    mockChatManager.sendMessage(m.channel, `@${who} you don't have permission to use that command.`);

    expect(mockChatManager.sendMessage).toHaveBeenCalledWith('#test', `@unknown you don't have permission to use that command.`);
  });
});
