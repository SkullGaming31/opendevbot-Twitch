import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';

import { loadCommands } from '../src/commands/loader';

// import the actual commands for unit tests
import pingCmd from '../src/commands/ping';
import helpCmd from '../src/commands/help';

describe('commands loader', () => {
  it('loads commands from directory and validates metadata', () => {
    const commandsDir = path.join(__dirname, 'fixtures', 'commands-valid');
    const commands = loadCommands(commandsDir);
    // should contain ping and help
    expect(commands.get('ping')).toBeDefined();
    expect(commands.get('help')).toBeDefined();
    // aliases should map (help has alias 'commands')
    expect(commands.get('commands')).toBeDefined();
  });

  it('skips invalid command files', () => {
    const commandsDir = path.join(__dirname, 'fixtures', 'commands-invalid');
    const commands = loadCommands(commandsDir);
    expect(commands.size).toBeGreaterThan(0);
    // invalid file doesn't throw and is not included
    expect(Array.from(commands.values()).some((c) => c.name === 'invalid')).toBe(false);
  });
});

describe('ping command', () => {
  it('has correct metadata and responds with pong', async () => {
    expect(pingCmd.name).toBe('ping');
    const mockChat = { sendMessage: vi.fn() };
    await pingCmd.execute({ channel: '#test', args: [], chatManager: mockChat });
    expect(mockChat.sendMessage).toHaveBeenCalledWith('#test', 'pong!');
  });
});

describe('help command', () => {
  it('lists commands from provided commands map', async () => {
    const mockChatManager = { sendMessage: vi.fn() } as any;

    // create a small commands map (with duplicate aliases) to pass to help
    const cmdA = { name: 'foo', description: 'Foo command' } as any;
    const cmdB = { name: 'bar', description: 'Bar command' } as any;
    const map = new Map<string, any>();
    map.set('foo', cmdA);
    map.set('bar', cmdB);
    map.set('f', cmdA); // alias

    await helpCmd.execute({ channel: '#test', chatManager: mockChatManager, commands: map });

    expect(mockChatManager.sendMessage).toHaveBeenCalled();
    const msg = (mockChatManager.sendMessage as any).mock.calls[0][1];
    expect(msg).toContain('!foo');
    expect(msg).toContain('!bar');
  });
});
