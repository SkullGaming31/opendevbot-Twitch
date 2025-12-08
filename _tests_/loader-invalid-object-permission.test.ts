import { describe, it, expect } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { loadCommands } from '../src/Commands/core/loader';

describe('loader invalid object permission', () => {
  it('skips command files with permission as object', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cmdtest-'));
    const badFile = path.join(tmp, 'badObj.js');
    const contents = `module.exports = { name: 'badobj', permission: { role: 'mod' }, execute: function(){} };`;
    fs.writeFileSync(badFile, contents, { encoding: 'utf8' });

    const commands = loadCommands(tmp);
    expect(Array.from(commands.values()).some((c) => c.name === 'badobj')).toBe(false);

    try { fs.unlinkSync(badFile); fs.rmdirSync(tmp); } catch { }
  });
});
