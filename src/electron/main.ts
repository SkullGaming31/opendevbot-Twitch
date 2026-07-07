import { app, BrowserWindow } from 'electron';
import path from 'path';
import { spawn, fork } from 'child_process';
import { ipcMain } from 'electron';
import fs from 'fs';
import http from 'http';
import https from 'https';
import net from 'net';

// Disable hardware acceleration and add Chromium flags to avoid GPU process crashes
// Keep this configurable: set ELECTRON_DISABLE_GPU=0 to skip disabling on systems
if (process.env.ELECTRON_DISABLE_GPU !== '0') {
	try {
		app.disableHardwareAcceleration();
	} catch (e) {
		// ignore if not available in this runtime
		console.warn('Could not disable hardware acceleration:', e);
	}

	// Append common chromium flags that force software rendering and reduce GPU usage
	app.commandLine.appendSwitch('disable-gpu');
	app.commandLine.appendSwitch('disable-software-rasterizer');
	app.commandLine.appendSwitch('disable-gpu-compositing');
	app.commandLine.appendSwitch('disable-accelerated-2d-canvas');
	app.commandLine.appendSwitch('disable-accelerated-video-decode');
	app.commandLine.appendSwitch('disable-accelerated-video-encode');
	app.commandLine.appendSwitch('disable-gpu-vsync');
	app.commandLine.appendSwitch('disable-zero-copy');
}

const isDev = process.env.NODE_ENV !== 'production';

let serverProcess: ReturnType<typeof spawn> | null = null;
let serverReadySent = false;

function sendServerReady(ready: boolean, info?: unknown) {
	try {
		const wins = BrowserWindow.getAllWindows();
		for (const w of wins) {
			try { w.webContents.send('server-ready', { ready, info }); } catch { /* ignore per-window errors */ }
		}
	} catch { /* ignore */ }
}

function sendServerLog(msg: string) {
	try {
		const wins = BrowserWindow.getAllWindows();
		for (const w of wins) {
			try { w.webContents.send('server-log', msg); } catch { /* ignore per-window errors */ }
		}
	} catch { /* ignore */ }
}

// Disable hardware acceleration / GPU process to avoid crashes on some Windows setups.
// Must be called before `app.whenReady()` or creating BrowserWindow.
try {
	app.disableHardwareAcceleration();
	app.commandLine.appendSwitch('disable-gpu');
	app.commandLine.appendSwitch('disable-gpu-compositing');
} catch (err) {
	// If app is not yet usable or these calls fail, log and continue — not fatal.
	// This is defensive; in usual Electron runtime these calls are safe here.
	console.warn('Could not disable hardware acceleration:', err?.toString?.() ?? err);
}

function startServer() {
	if (serverProcess) return;
	// Resolve server entry — prefer compiled `dist/index.js`, then project root `index.js`.
	const serverCandidates = [
		// when running from `dist/electron` or `src/electron`
		path.resolve(__dirname, '..', '..', 'dist', 'index.js'),
		// project-level dist
		path.resolve(process.cwd(), 'dist', 'index.js'),
		// project root (uncompiled or built to root)
		path.resolve(process.cwd(), 'index.js'),
		// fallback: two levels up from this file (previous heuristic)
		path.resolve(__dirname, '..', '..', 'index.js'),
	];

	let serverPath: string | undefined;
	for (const p of serverCandidates) {
		try {
			if (fs.existsSync(p)) { serverPath = p; break; }
		} catch {
			// ignore
		}
	}

	if (!serverPath) {
		console.warn('[server] no compiled server entry found; will try TypeScript source if available');
	}
	// If ELECTRON_SKIP_SERVER=1 is set, don't attempt to spawn the server.
	if (process.env.ELECTRON_SKIP_SERVER === '1') {
		console.log('[server] skipping spawn due to ELECTRON_SKIP_SERVER=1');
		return;
	}

	// Quick probe: if a server is already listening on the expected port,
	// skip spawning a child process and reuse the external server. This helps
	// when running Electron alongside a separately-run server (dev workflow).
	const probe = () => new Promise<boolean>((resolve) => {
		try {
			const sock = new net.Socket();
			let done = false;
			sock.setTimeout(800);
			sock.once('connect', () => { done = true; sock.destroy(); resolve(true); });
			sock.once('error', () => { if (!done) { done = true; resolve(false); } });
			sock.once('timeout', () => { if (!done) { done = true; sock.destroy(); resolve(false); } });
			sock.connect(3001, '127.0.0.1');
		} catch {
			resolve(false);
		}
	});

	// Probe and then decide whether to fork.
	probe().then((up) => {
		if (up) {
			console.log('[server] detected external server at http://localhost:3001, not spawning child');
			return;
		}
		// Use the system `node` executable to run the compiled server. Using
		// `process.execPath` inside Electron would invoke the Electron binary,
		// which is not a drop-in replacement for node when executed with a
		// script argument. Spawning `node` ensures the server runs as a normal
		// Node process and avoids unexpected exits.
		// If we have a compiled server JS, fork it. Otherwise try running the
		// TypeScript source with `node -r ts-node/register src/index.ts` if
		// `src/index.ts` exists. This supports a dev workflow without running
		// a separate build step.
		try {
			if (serverPath && fs.existsSync(serverPath)) {
				console.log('[server] forking compiled server:', serverPath);
				const child = fork(serverPath, { env: process.env, silent: true });
				serverProcess = child;
				child.stdout?.on('data', (b) => {
					const m = b.toString().trim();
					console.log('[server]', m);
					sendServerLog(m);
					try {
						// Detect the chat manager ready line used by this bot to indicate
						// the backend is fully started for chat operations.
						if (!serverReadySent && /chat manager connected/i.test(m)) {
							serverReadySent = true;
							sendServerReady(true, { reason: 'chat-manager', line: m });
						}
					} catch { /* ignore parse errors */ }
				});
				child.stderr?.on('data', (b) => {
					const m = b.toString().trim();
					console.error('[server:err]', m);
					sendServerLog(`[err] ${m}`);
				});
				child.on('exit', (code) => { console.log('[server] exited', code); serverProcess = null; serverReadySent = false; sendServerReady(false, { code }); });
				child.on('error', (err) => { console.error('[server] child error:', err); serverProcess = null; serverReadySent = false; sendServerReady(false, { error: String(err) }); });
				return;
			}

			// Try TypeScript source fallback
			const srcIndex = path.resolve(process.cwd(), 'src', 'index.ts');
			if (fs.existsSync(srcIndex)) {
				const nodeCmd = process.env.NODE_BINARY || 'node';
				console.log('[server] spawning ts-node for:', srcIndex);
				const child = spawn(nodeCmd, ['-r', 'ts-node/register', srcIndex], { env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
				serverProcess = child;
				child.stdout?.on('data', (b) => {
					const m = b.toString().trim();
					console.log('[server]', m);
					sendServerLog(m);
					try {
						if (!serverReadySent && /chat manager connected/i.test(m)) {
							serverReadySent = true;
							sendServerReady(true, { reason: 'chat-manager', line: m });
						}
					} catch { /** Empty Catch */ }
				});
				child.stderr?.on('data', (b) => {
					const m = b.toString().trim();
					console.error('[server:err]', m);
					sendServerLog(`[err] ${m}`);
				});
				child.on('exit', (code) => { console.log('[server] exited', code); serverProcess = null; serverReadySent = false; sendServerReady(false, { code }); });
				child.on('error', (err) => { console.error('[server] spawn error:', err); serverProcess = null; serverReadySent = false; sendServerReady(false, { error: String(err) }); });
				return;
			}

			console.error('[server] no server file found to run (checked compiled and src/index.ts)');
		} catch (err) {
			console.error('Failed to start server process:', err);
		}
	});
}

// (removed probeStatusSync — replaced by TCP port probe `probePortOpen`)

// Probe a TCP port and return true if connectable within timeout.
function probePortOpen(host: string, port: number, timeout = 800): Promise<boolean> {
	return new Promise((resolve) => {
		try {
			const sock = new net.Socket();
			let done = false;
			sock.setTimeout(timeout);
			sock.once('connect', () => { done = true; sock.destroy(); resolve(true); });
			sock.once('error', () => { if (!done) { done = true; resolve(false); } });
			sock.once('timeout', () => { if (!done) { done = true; sock.destroy(); resolve(false); } });
			sock.connect(port, host);
		} catch {
			resolve(false);
		}
	});
}

// Perform a simple HTTP GET to the backend health path and return status/body
function fetchHealthStatus(host: string, port: number, path = '/api/v1/health', timeout = 1200): Promise<{ status: number; body: unknown } | null> {
	return new Promise((resolve) => {
		try {
			const u = new URL(`http://${host}:${port}${path}`);
			const client = u.protocol === 'https:' ? https : http;
			const req = client.request({ method: 'GET', host: u.hostname, port: Number(u.port), path: u.pathname, timeout }, (res) => {
				const chunks: Buffer[] = [];
				res.on('data', (b) => chunks.push(Buffer.from(b)));
				res.on('end', () => {
					try {
						const body = Buffer.concat(chunks).toString('utf8');
						const parsed = (() => { try { return JSON.parse(body); } catch { return { raw: body }; } })();
						resolve({ status: res.statusCode ?? 0, body: parsed });
					} catch {
						resolve({ status: res.statusCode ?? 0, body: null });
					}
				});
			});
			req.on('error', () => resolve(null));
			req.on('timeout', () => { req.destroy(); resolve(null); });
			req.end();
		} catch {
			resolve(null);
		}
	});
}

async function createWindow() {
	const preloadCandidates = [
		path.resolve(__dirname, 'preload.js'),
		path.resolve(__dirname, '..', 'preload.js'),
		path.resolve(process.cwd(), 'src', 'electron', 'preload.js'),
	];

	let preloadPath: string | undefined;
	for (const p of preloadCandidates) {
		try {
			if (fs.existsSync(p)) { preloadPath = p; break; }
		} catch { /* empty catch */ }
	}

	const webPreferences: Electron.WebPreferences = {
		contextIsolation: true,
		nodeIntegration: false,
	} as Electron.WebPreferences;
	if (preloadPath) {
		webPreferences.preload = preloadPath as string;
	}

	const win = new BrowserWindow({
		width: 900,
		height: 700,
		webPreferences,
	});

	// Probe a URL to see if it responds (HTTP 200-ish)
	const probeUrl = (url: string) => new Promise<boolean>((resolve) => {
		try {
			const u = new URL(url);
			const client = u.protocol === 'https:' ? https : http;
			const req = client.request({ method: 'GET', host: u.hostname, port: u.port || (u.protocol === 'https:' ? 443 : 80), path: u.pathname || '/', timeout: 800 }, (res) => {
				// treat any 2xx-3xx as available; `statusCode` is optional on the
				// IncomingMessage type so guard against `undefined` to satisfy TS.
				const status = typeof res.statusCode === 'number' ? res.statusCode : 0;
				resolve(status >= 200 && status < 400);
			});
			req.on('error', () => resolve(false));
			req.on('timeout', () => { req.destroy(); resolve(false); });
			req.end();
		} catch {
			resolve(false);
		}
	});

	// Candidate UI locations (env override first)
	const candidates = [] as string[];
	if (process.env.ELECTRON_UI_URL) candidates.push(process.env.ELECTRON_UI_URL);
	candidates.push('http://localhost:4000');
	candidates.push('http://localhost:3001');

	// Check for a local UI file shipped with the repo. Try a few likely
	// locations so this works both when running from `src` and from `dist`.
	const localUiCandidates = [
		path.resolve(__dirname, 'ui', 'index.html'),
		path.resolve(__dirname, '..', 'ui', 'index.html'),
		path.resolve(process.cwd(), 'src', 'electron', 'ui', 'index.html'),
	];

	let loaded = false;

	for (const p of localUiCandidates) {
		try {
			if (fs.existsSync(p)) {
				console.log('[electron] loading local UI file', p);
				await win.loadFile(p);
				loaded = true;
				break;
			}
		} catch {
			// ignore
		}
	}

	for (const url of candidates) {
		// skip empty
		if (!url) continue;
		console.log('[electron] probing', url);
		// wait for a quick probe

		const ok = await probeUrl(url).catch(() => false);
		if (ok) {
			// load the detected UI
			await win.loadURL(url);
			loaded = true;
			break;
		}
	}

	if (!loaded) {
		const html = `
    <!doctype html>
    <html>
    <head><meta charset="utf-8"><title>OpenDevBot</title></head>
    <body>
      <h1>OpenDevBot</h1>
      <p>Electron shell for the bot. Server logs are printed to the terminal.</p>
      <p>If your backend serves an HTTP UI, open it at its address (e.g. <code>http://localhost:4000</code>), or set the environment variable <code>ELECTRON_UI_URL</code>.</p>
    </body>
    </html>
    `;
		await win.loadURL('data:text/html,' + encodeURIComponent(html));
	}

	// Only open DevTools automatically when explicitly requested to avoid
	// popping them open on every start. Set `ELECTRON_OPEN_DEVTOOLS=1`
	// to opt-in during development.
	if (isDev && (process.env.ELECTRON_OPEN_DEVTOOLS === '1' || process.env.ELECTRON_OPEN_DEVTOOLS === 'true')) {
		win.webContents.openDevTools();
	}
}

// (multi-window support removed)

// Expose startServer via IPC so the renderer can request the backend be started.
ipcMain.handle('start-server', async () => {
	try {
		startServer();

		// Wait for backend to open port 3001. Poll for up to 10 seconds.
		const host = '127.0.0.1';
		const port = 3001;
		const timeoutMs = 10000;
		const interval = 500;
		const start = Date.now();
		let open = false;
		while (Date.now() - start < timeoutMs) {
			open = await probePortOpen(host, port, 800).catch(() => false);
			if (open) break;
			await new Promise((r) => setTimeout(r, interval));
		}

		if (open) {
			// Try to get an HTTP response from the backend health endpoint so the
			// renderer can show an HTTP status instead of "no http response".
			const health = await fetchHealthStatus('127.0.0.1', port, '/api/v1/health', 1200).catch(() => null);
			const status = health?.status ?? 0;
			return { ok: true, port, status, body: health?.body ?? null };
		}
		return { ok: false, error: 'timeout waiting for backend port' };
	} catch (err: unknown) {
		return { ok: false, error: String(err) };
	}
});

// Allow the renderer to request stopping the spawned child server (if present)
ipcMain.handle('stop-server', async () => {
	try {
		if (!serverProcess) return { ok: false, error: 'no-child' };
		try {
			serverProcess.kill();
		} catch {
			try { serverProcess?.kill('SIGKILL'); } catch { /* ignore */ }
		}
		serverProcess = null;
		sendServerLog('[local] server process stopped by UI');
		return { ok: true };
	} catch (err: unknown) {
		return { ok: false, error: String(err) };
	}
});

app.whenReady().then(() => {
	// Start the compiled server process only when explicitly enabled via
	// `ELECTRON_AUTO_START_SERVER=1`. Default behavior is to let the user
	// start the backend from the UI button to avoid unexpected spawn errors.
	if (process.env.ELECTRON_AUTO_START_SERVER === '1') {
		startServer();
	} else {
		console.log('[server] auto-start disabled; use the UI Start Backend button or set ELECTRON_AUTO_START_SERVER=1');
	}
	// Optionally run headless (no BrowserWindow) to avoid GPU usage/crashes.
	// Set `ELECTRON_HEADLESS=1` in the environment to skip creating a window.
	if (process.env.ELECTRON_HEADLESS !== '1') {
		createWindow();
	} else {
		console.log('Running Electron in headless mode (no BrowserWindow)');
	}

	// Start a periodic health poller to check backend /api/v1/health every 5 minutes.
	// This sends 'server-health' IPC messages to any renderer windows.
	const HEALTH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
	let healthTimer: NodeJS.Timeout | null = null;
	const healthProbe = async () => {
		try {
			const u = new URL('http://127.0.0.1:3001/api/v1/health');
			const client = u.protocol === 'https:' ? https : http;
			const req = client.request({ method: 'GET', host: u.hostname, port: u.port || 80, path: u.pathname, timeout: 3000 }, (res) => {
				const chunks: Buffer[] = [];
				res.on('data', (b) => chunks.push(Buffer.from(b)));
				res.on('end', () => {
					try {
						const body = Buffer.concat(chunks).toString('utf8');
						const parsed = (() => { try { return JSON.parse(body); } catch { return { raw: body }; } })();
						const msg = { ok: true, status: res.statusCode ?? 0, body: parsed, time: new Date().toISOString() };
						try { const wins = BrowserWindow.getAllWindows(); for (const w of wins) w.webContents.send('server-health', msg); } catch { /** empty catch */ }
					} catch { /* ignore parse errors */ }
				});
			});
			req.on('error', () => { try { const wins = BrowserWindow.getAllWindows(); for (const w of wins) w.webContents.send('server-health', { ok: false }); } catch { /** empty catch */ } });
			req.on('timeout', () => { req.destroy(); try { const wins = BrowserWindow.getAllWindows(); for (const w of wins) w.webContents.send('server-health', { ok: false }); } catch { /** empty catch */ } });
			req.end();
		} catch {
			try { const wins = BrowserWindow.getAllWindows(); for (const w of wins) w.webContents.send('server-health', { ok: false }); } catch { /** empty catch */ }
		}
	};
	// immediate probe, then periodic
	healthProbe();
	healthTimer = setInterval(healthProbe, HEALTH_INTERVAL_MS);

	app.on('before-quit', () => {
		if (healthTimer) { clearInterval(healthTimer); healthTimer = null; }
	});

	app.on('activate', () => {
		if (BrowserWindow.getAllWindows().length === 0) createWindow();
	});
});

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') app.quit();
});

app.on('quit', () => {
	if (serverProcess) serverProcess.kill();
});

export { };
