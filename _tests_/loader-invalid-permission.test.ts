import { describe, it, expect } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { loadCommands } from '../src/Commands/core/loader';

describe('loader permission validation', () => {
  it('skips command files with invalid permission value', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cmdtest-'));
    const badFile = path.join(tmp, 'badCmd.js');
    const contents = `module.exports = { name: 'badperm', permission: 123, execute: function(){} };`;
    fs.writeFileSync(badFile, contents, { encoding: 'utf8' });

    const commands = loadCommands(tmp);
    // should skip the invalid-permission command
    expect(Array.from(commands.values()).some((c) => c.name === 'badperm')).toBe(false);

    // cleanup
    try { fs.unlinkSync(badFile); fs.rmdirSync(tmp); } catch { }
  });
});
