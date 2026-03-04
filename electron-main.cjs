const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const isDev = !app.isPackaged;
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const dns = require('dns').promises;

let xrayProcess = null;
let tunProcess = null;
let mainWindow = null;
let originalGateway = null;
let activeMode = null; // 'proxy' | 'tun'
let statsInterval = null;
let lastBytes = { rx: 0, tx: 0 };

const STATE_FILE = '/tmp/zenoray_state.json';

// ============================================================
// STATE PERSISTENCE: Save/load connection state for crash recovery
// ============================================================
function saveState() {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify({
      mode: activeMode,
      gateway: originalGateway,
      timestamp: Date.now(),
    }));
  } catch { /* ignore */ }
}

function clearState() {
  try { fs.unlinkSync(STATE_FILE); } catch { /* ignore */ }
}

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    }
  } catch { /* ignore */ }
  return null;
}

// ============================================================
// HELPER: Get active network service name (e.g. "Wi-Fi")
// ============================================================
function getActiveNetworkService() {
  try {
    const output = execSync('networksetup -listallnetworkservices').toString();
    const services = output.split('\n').filter(s => s && !s.startsWith('*') && !s.startsWith('An'));
    for (const preferred of ['Wi-Fi', 'Ethernet', 'USB 10/100/1000 LAN']) {
      if (services.includes(preferred)) return preferred;
    }
    return services[0] || 'Wi-Fi';
  } catch {
    return 'Wi-Fi';
  }
}

// ============================================================
// HELPER: Get current default gateway
// ============================================================
function getDefaultGateway() {
  // Method 1: route command
  try {
    const output = execSync("route -n get default 2>/dev/null | grep gateway | awk '{print $2}'").toString().trim();
    if (output && output.match(/^\d+\.\d+\.\d+\.\d+$/)) return output;
  } catch { /* try next */ }

  // Method 2: netstat
  try {
    const output = execSync("netstat -rn 2>/dev/null | grep '^default' | head -1 | awk '{print $2}'").toString().trim();
    if (output && output.match(/^\d+\.\d+\.\d+\.\d+$/)) return output;
  } catch { /* try next */ }

  // Method 3: networksetup (router IP from active network service)
  try {
    const service = getActiveNetworkService();
    const output = execSync(`networksetup -getinfo "${service}" 2>/dev/null | grep "^Router" | awk '{print $2}'`).toString().trim();
    if (output && output.match(/^\d+\.\d+\.\d+\.\d+$/)) return output;
  } catch { /* try next */ }

  // Method 4: scutil
  try {
    const output = execSync("echo 'show State:/Network/Global/IPv4' | scutil | grep Router | awk '{print $3}'").toString().trim();
    if (output && output.match(/^\d+\.\d+\.\d+\.\d+$/)) return output;
  } catch { /* give up */ }

  return null;
}
// ============================================================
// ADMIN: Install one-time sudoers entry so TUN commands don't need password
// ============================================================
const SUDOERS_FILE = '/etc/sudoers.d/zenoray';

function isAdminInstalled() {
  try {
    return fs.existsSync(SUDOERS_FILE);
  } catch {
    return false;
  }
}

function installAdminPrivileges() {
  if (isAdminInstalled()) {
    console.log('[ZenoRay] Admin privileges already installed');
    return true;
  }

  try {
    const username = execSync('whoami').toString().trim();
    const tun2socksBundled = findBinary('tun2socks');

    // Collect all possible paths (bundled + system)
    const allowedPaths = new Set([
      '/usr/local/bin/tun2socks',
      '/opt/homebrew/bin/tun2socks',
      '/sbin/route',
      '/sbin/ifconfig',
      '/usr/sbin/networksetup',
      '/bin/kill',
      '/usr/bin/killall',
      '/bin/bash',
    ]);

    if (tun2socksBundled) allowedPaths.add(tun2socksBundled);

    const sudoersContent = Array.from(allowedPaths)
      .map(p => `${username} ALL=(ALL) NOPASSWD: ${p}`)
      .join('\\n');

    execSync(
      `osascript -e 'do shell script "echo \\"${sudoersContent}\\" > ${SUDOERS_FILE} && chmod 0440 ${SUDOERS_FILE}" with administrator privileges'`,
      { timeout: 60000 }
    );
    console.log('[ZenoRay] Admin privileges installed successfully');
    return true;
  } catch (e) {
    console.error('[ZenoRay] Failed to install admin privileges:', e.message);
    return false;
  }
}

// Run a script with sudo (no password after installAdminPrivileges)
function runAsRoot(scriptPath) {
  return new Promise((resolve) => {
    const child = spawn('sudo', ['/bin/bash', scriptPath]);
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ ok: true, output: stdout });
      } else {
        console.error(`[ZenoRay] Root command failed (code ${code}):`, stderr);
        resolve({ ok: false, error: stderr || `Exit code ${code}` });
      }
    });

    child.on('error', (err) => {
      resolve({ ok: false, error: err.message });
    });
  });
}

// ============================================================
// HELPER: Enable macOS system proxy (SOCKS + HTTP + HTTPS)
// ============================================================
function enableSystemProxy(socksPort, httpPort) {
  const service = getActiveNetworkService();
  try {
    execSync(`networksetup -setsocksfirewallproxy "${service}" 127.0.0.1 ${socksPort}`);
    execSync(`networksetup -setsocksfirewallproxystate "${service}" on`);
    execSync(`networksetup -setwebproxy "${service}" 127.0.0.1 ${httpPort}`);
    execSync(`networksetup -setwebproxystate "${service}" on`);
    execSync(`networksetup -setsecurewebproxy "${service}" 127.0.0.1 ${httpPort}`);
    execSync(`networksetup -setsecurewebproxystate "${service}" on`);
    console.log(`[ZenoRay] System proxy ON → SOCKS5:${socksPort} + HTTP/S:${httpPort} (${service})`);
    return true;
  } catch (e) {
    console.error('[ZenoRay] Failed to set system proxy:', e.message);
    return false;
  }
}

// ============================================================
// HELPER: Disable ALL macOS system proxies
// ============================================================
function disableSystemProxy() {
  const service = getActiveNetworkService();
  try {
    execSync(`networksetup -setsocksfirewallproxystate "${service}" off`);
    execSync(`networksetup -setwebproxystate "${service}" off`);
    execSync(`networksetup -setsecurewebproxystate "${service}" off`);
    console.log(`[ZenoRay] All system proxies OFF (${service})`);
  } catch (e) {
    console.error('[ZenoRay] Failed to disable system proxy:', e.message);
  }
}

// ============================================================
// HELPER: Find binary (xray or tun2socks)
// ============================================================
function findBinary(name) {
  // 1. Packaged app: extraResources path
  const bundled = path.join(process.resourcesPath, 'bin', name);
  if (fs.existsSync(bundled)) {
    try { fs.chmodSync(bundled, 0o755); } catch { /* ok */ }
    return bundled;
  }

  // 2. Dev mode: project root bin/
  const devBundled = path.join(__dirname, 'bin', name);
  if (fs.existsSync(devBundled)) return devBundled;

  // 3. Homebrew fallback
  const brewPaths = [`/opt/homebrew/bin/${name}`, `/usr/local/bin/${name}`];
  for (const p of brewPaths) {
    if (fs.existsSync(p)) return p;
  }

  // 4. System PATH
  try {
    const which = execSync(`which ${name}`).toString().trim();
    if (which) return which;
  } catch { /* not found */ }

  return null;
}

// ============================================================
// TUN MODE: Enable (creates virtual network interface)
// ============================================================
function enableTunMode(socksPort, xrayServerIPs) {
  const tun2socksBin = findBinary('tun2socks');
  if (!tun2socksBin) {
    return Promise.resolve({ success: false, error: 'tun2socks not found. Download from: github.com/xjasonlyu/tun2socks/releases' });
  }

  // Save original gateway for later restoration
  originalGateway = getDefaultGateway();
  console.log(`[ZenoRay] Original gateway: ${originalGateway}`);

  if (!originalGateway) {
    return Promise.resolve({ success: false, error: 'Cannot detect default gateway. Check your network connection.' });
  }

  const service = getActiveNetworkService();
  const pidFile = '/tmp/zenoray_tun2socks.pid';
  const scriptFile = '/tmp/zenoray_tun_start.sh';
  const tunLogFile = '/tmp/zenoray_tun2socks.log';

  // Write a shell script—avoids syntax issues with & and paths with spaces
  // Redirect all I/O so the script doesn't hang waiting for child process
  const scriptLines = [
    '#!/bin/bash',
    '',
    '# Kill any leftover tun2socks from previous crashed session',
    'sudo killall tun2socks 2>/dev/null || true',
    'sleep 1',
    '',
    '# Start tun2socks',
    `sudo "${tun2socksBin}" -device utun99 -proxy socks5://127.0.0.1:${socksPort} > ${tunLogFile} 2>&1 &`,
    'TUN_PID=$!',
    `echo $TUN_PID > ${pidFile}`,
    'sleep 2',
    'if ! kill -0 $TUN_PID 2>/dev/null; then',
    `  cat ${tunLogFile} >&2`,
    '  echo "tun2socks failed to start" >&2',
    '  exit 1',
    'fi',
    '',
    '# Configure network',
    'sudo ifconfig utun99 198.18.0.1 198.18.0.1 netmask 255.255.255.0 up',
    ...(originalGateway && Array.isArray(xrayServerIPs) ? xrayServerIPs.map(ip => `sudo route add -host ${ip} ${originalGateway}`) : []),
    `sudo route add 1.1.1.1 ${originalGateway} 2>/dev/null || true`,
    `sudo route add 8.8.8.8 ${originalGateway} 2>/dev/null || true`,
    'sudo route delete default',
    'sudo route add default 198.18.0.1',
    `sudo networksetup -setdnsservers "${service}" 1.1.1.1 8.8.8.8`,
    'echo "TUN mode active"',
  ];

  fs.writeFileSync(scriptFile, scriptLines.join('\n'), { mode: 0o755 });

  return new Promise(async (resolve) => {
    const result = await runAsRoot(scriptFile);

    if (result.ok) {
      try {
        const pid = fs.readFileSync(pidFile, 'utf-8').trim();
        console.log(`[ZenoRay] tun2socks PID: ${pid}`);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('xray-log', `[TUN] tun2socks running (PID: ${pid})`);
          mainWindow.webContents.send('xray-log', `[TUN] Interface utun99 → 198.18.0.1`);
          mainWindow.webContents.send('xray-log', `[TUN] DNS: 1.1.1.1, 8.8.8.8`);
        }
      } catch { /* ok */ }

      console.log('[ZenoRay] TUN mode enabled: all traffic via utun99');
      resolve({ success: true });
    } else {
      resolve({ success: false, error: `TUN setup failed: ${result.error}` });
    }
  });
}

// ============================================================
// TUN MODE: Disable
// ============================================================
function disableTunMode(xrayServerIP) {
  const pidFile = '/tmp/zenoray_tun2socks.pid';
  const scriptFile = '/tmp/zenoray_tun_stop.sh';
  const service = getActiveNetworkService();

  const scriptLines = ['#!/bin/bash'];

  // Kill tun2socks
  try {
    if (fs.existsSync(pidFile)) {
      const pid = fs.readFileSync(pidFile, 'utf-8').trim();
      scriptLines.push(`sudo kill ${pid} 2>/dev/null || true`);
    }
  } catch { /* ignore */ }
  scriptLines.push('sudo killall tun2socks 2>/dev/null || true');

  // Restore routes
  if (originalGateway) {
    scriptLines.push('sudo route delete default 2>/dev/null || true');
    scriptLines.push(`sudo route add default ${originalGateway}`);
    if (xrayServerIP) {
      scriptLines.push(`sudo route delete -host ${xrayServerIP} 2>/dev/null || true`);
    }
  }

  // Restore DNS
  scriptLines.push(`sudo networksetup -setdnsservers "${service}" empty`);
  if (originalGateway) {
    scriptLines.push(`sudo route delete 1.1.1.1 ${originalGateway} 2>/dev/null || true`);
    scriptLines.push(`sudo route delete 8.8.8.8 ${originalGateway} 2>/dev/null || true`);
  }

  fs.writeFileSync(scriptFile, scriptLines.join('\n'), { mode: 0o755 });

  // Run synchronously for cleanup scenarios (app quit)
  try {
    execSync(`bash ${scriptFile}`, { timeout: 10000 });
  } catch (e) {
    console.error('[ZenoRay] TUN cleanup error:', e.message);
  }

  try { fs.unlinkSync(pidFile); } catch { /* ignore */ }
  try { fs.unlinkSync(scriptFile); } catch { /* ignore */ }
  if (statsInterval) { clearInterval(statsInterval); statsInterval = null; }
  console.log(`[ZenoRay] TUN mode disabled. Gateway restored to ${originalGateway || 'auto'}`);
  originalGateway = null;
  tunProcess = null;
}

// ============================================================
// CLEANUP ALL
// ============================================================
function cleanupAll(xrayServerIP) {
  // Also try to read state file in case variables were lost (force quit scenario)
  const state = loadState();
  const mode = activeMode || (state && state.mode);
  const gateway = originalGateway || (state && state.gateway);

  if (mode === 'tun') {
    if (gateway) originalGateway = gateway;
    disableTunMode(xrayServerIP);
  } else if (mode === 'proxy') {
    disableSystemProxy();
  } else {
    // Unknown state—clean both just in case
    disableSystemProxy();
    // Try tun cleanup if pid file exists
    if (fs.existsSync('/tmp/zenoray_tun2socks.pid')) {
      if (gateway) originalGateway = gateway;
      disableTunMode(xrayServerIP);
    }
  }
  if (xrayProcess) { xrayProcess.kill(); xrayProcess = null; }
  if (tunProcess) { tunProcess.kill(); tunProcess = null; }
  if (statsInterval) { clearInterval(statsInterval); statsInterval = null; }
  activeMode = null;
  clearState();
}

// ============================================================
// STARTUP CLEANUP: Recover from previous crash
// ============================================================
function startupCleanup() {
  const state = loadState();
  if (!state) return;

  console.log(`[ZenoRay] Found leftover state from previous session (mode: ${state.mode})`);

  if (state.mode === 'tun' && state.gateway) {
    originalGateway = state.gateway;
    console.log(`[ZenoRay] Restoring network from crashed TUN session (gateway: ${state.gateway})`);
    disableTunMode();
  } else if (state.mode === 'proxy') {
    console.log('[ZenoRay] Cleaning up leftover proxy settings');
    disableSystemProxy();
  }

  // Kill any orphaned tun2socks
  try { execSync('killall tun2socks 2>/dev/null || true'); } catch { /* ok */ }

  clearState();
  console.log('[ZenoRay] Startup cleanup complete');
}

// ============================================================
// MAIN WINDOW
// ============================================================
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 950,
    minHeight: 650,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#050505',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(
    isDev
      ? 'http://localhost:5173'
      : `file://${path.join(__dirname, 'dist/index.html')}`
  );

  if (isDev) {
    // mainWindow.webContents.openDevTools();
  }

  // ========================================================
  // IPC: Settings Persistence (JSON)
  // ========================================================
  const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json');

  ipcMain.handle('get-settings', async () => {
    try {
      if (fs.existsSync(SETTINGS_FILE)) {
        const data = fs.readFileSync(SETTINGS_FILE, 'utf-8');
        return JSON.parse(data);
      }
    } catch (e) {
      console.error('[ZenoRay] Error loading settings:', e.message);
    }
    return null;
  });

  ipcMain.handle('save-settings', async (_event, settings) => {
    try {
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
      return { success: true };
    } catch (e) {
      console.error('[ZenoRay] Error saving settings:', e.message);
      return { success: false, error: e.message };
    }
  });

  // ========================================================
  // IPC: Onboarding Setup Handlers
  // ========================================================
  const SETUP_COMPLETE_FILE = path.join(app.getPath('userData'), 'setup_complete.json');

  ipcMain.handle('check-setup-status', async () => {
    return fs.existsSync(SETUP_COMPLETE_FILE);
  });

  ipcMain.handle('install-admin-privileges', async () => {
    return installAdminPrivileges();
  });

  ipcMain.handle('complete-setup', async () => {
    try {
      fs.writeFileSync(SETUP_COMPLETE_FILE, JSON.stringify({ completed: true, timestamp: Date.now() }));
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // ========================================================
  // IPC: Check dependencies
  // ========================================================
  ipcMain.handle('check-deps', async () => {
    const xray = findBinary('xray');
    const tun2socks = findBinary('tun2socks');
    return {
      xray: { found: !!xray, path: xray },
      tun2socks: { found: !!tun2socks, path: tun2socks },
    };
  });

  // ========================================================
  // IPC: Ping test (latency check without full connect)
  // ========================================================
  ipcMain.handle('ping-test', async (_event, { configJson }) => {
    const xrayBin = findBinary('xray');
    if (!xrayBin) {
      return { success: false, error: 'Xray not found' };
    }

    // Write temp config (uses port 10808 to avoid conflict with main connection)
    const tempConfig = JSON.parse(configJson);
    // Override inbound to use a temp port, socks only
    tempConfig.inbounds = [{
      port: 10808,
      listen: '127.0.0.1',
      protocol: 'socks',
      settings: { auth: 'noauth', udp: false },
    }];
    const tempConfigPath = path.join(app.getPath('userData'), 'xray_ping_config.json');
    fs.writeFileSync(tempConfigPath, JSON.stringify(tempConfig));

    return new Promise((resolve) => {
      const tempProcess = spawn(xrayBin, ['run', '-c', tempConfigPath]);
      let settled = false;
      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          tempProcess.kill();
          resolve({ success: false, error: 'Timeout (10s)' });
        }
      }, 10000);

      tempProcess.on('error', () => {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          resolve({ success: false, error: 'Failed to start Xray' });
        }
      });

      // Wait for Xray to start, then test through proxy
      setTimeout(async () => {
        if (settled) return;

        const start = Date.now();
        try {
          // Use curl through the temp SOCKS proxy to test connectivity
          execSync(
            'curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 --max-time 8 --socks5 127.0.0.1:10808 http://cp.cloudflare.com',
            { timeout: 9000 }
          );
          const latency = Date.now() - start;

          if (!settled) {
            settled = true;
            clearTimeout(timeout);
            tempProcess.kill();
            resolve({ success: true, latency });
          }
        } catch (e) {
          if (!settled) {
            settled = true;
            clearTimeout(timeout);
            tempProcess.kill();
            resolve({ success: false, error: 'Server unreachable', latency: Date.now() - start });
          }
        }
      }, 1500);
    });
  });

  // ========================================================
  // IPC: Connect VPN
  // mode: 'proxy' | 'tun'
  // ========================================================
  ipcMain.handle('vpn-connect', async (_event, { configJson, mode, serverIP }) => {
    if (xrayProcess) return { success: false, error: 'Already connected' };

    const xrayBin = findBinary('xray');
    if (!xrayBin) return { success: false, error: 'Xray binary not found' };

    if (mode === 'tun' && !findBinary('tun2socks')) {
      return { success: false, error: 'tun2socks not found' };
    }

    // 1. Write config
    const configPath = path.join(app.getPath('userData'), 'xray_config.json');
    fs.writeFileSync(configPath, configJson);

    // 2. Start Xray
    xrayProcess = spawn(xrayBin, ['run', '-c', configPath]);
    
    xrayProcess.stdout.on('data', (data) => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('xray-log', data.toString());
    });
    xrayProcess.stderr.on('data', (data) => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('xray-log', `[ERR] ${data.toString()}`);
    });

    // 3. Setup Connection Mode
    activeMode = mode;
    if (mode === 'tun') {
      let serverIPs = [serverIP];
      try {
        const lookups = await dns.lookup(serverIP, { all: true });
        serverIPs = lookups.map(l => l.address);
        console.log(`[ZenoRay] Resolved ${serverIP} to: ${serverIPs.join(', ')}`);
      } catch (e) { console.warn(`[ZenoRay] DNS lookup failed: ${e.message}`); }

      const tunResult = await enableTunMode(1080, serverIPs);
      if (!tunResult.success) {
        xrayProcess.kill(); xrayProcess = null; activeMode = null;
        return { success: false, error: tunResult.error };
      }
    } else {
      enableSystemProxy(1080, 1081);
    }

    // 4. Start Stats & State
    saveState();
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('vpn-status', { connected: true });

    // Fetch Public VPN IP (Robust Async Check)
    const { exec } = require('child_process');
    const fetchVPNIP = (attempt = 1) => {
      if (!activeMode || !mainWindow || mainWindow.isDestroyed()) return;
      
      // Use --socks5-hostname so Xray does the DNS resolution (prevents TUN leaks/loops)
      const cmd = 'curl -s --connect-timeout 8 --socks5-hostname 127.0.0.1:1080 https://api.ipify.org || curl -s --connect-timeout 8 --socks5-hostname 127.0.0.1:1080 https://ifconfig.me';
      
      exec(cmd, (error, stdout) => {
        const ip = stdout.trim();
        if (ip && ip.match(/^\d+\.\d+\.\d+\.\d+$/)) {
          console.log(`[ZenoRay] VPN Public IP detected: ${ip}`);
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('vpn-stats', { ip, down: 0, up: 0 });
          }
        } else if (attempt < 3) {
          console.log(`[ZenoRay] VPN IP detect attempt ${attempt} failed, retrying...`);
          setTimeout(() => fetchVPNIP(attempt + 1), 5000);
        }
      });
    };
    
    setTimeout(() => fetchVPNIP(), 5000);

    lastBytes = { rx: 0, tx: 0 };
    statsInterval = setInterval(() => {
      try {
        let rx = 0, tx = 0;
        if (mode === 'tun') {
          const out = execSync('netstat -I utun99 -b -n | tail -1').toString().split(/\s+/);
          rx = parseInt(out[6]); tx = parseInt(out[9]);
        } else {
          const out = execSync('netstat -I lo0 -b -n | tail -1').toString().split(/\s+/);
          rx = parseInt(out[6]); tx = parseInt(out[9]);
        }
        if (lastBytes.rx > 0) {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('vpn-stats', { down: Math.max(0, rx - lastBytes.rx), up: Math.max(0, tx - lastBytes.tx) });
          }
        }
        lastBytes = { rx, tx };
      } catch (e) {}
    }, 1000);

    return { success: true, message: `Connected in ${mode.toUpperCase()} mode` };
  });

  // ========================================================
  // IPC: Disconnect VPN
  // ========================================================
  ipcMain.handle('vpn-disconnect', async (_event, { serverIP } = {}) => {
    cleanupAll(serverIP);
    return { success: true };
  });
}

// ============================================================
// APP LIFECYCLE
// ============================================================
app.whenReady().then(() => {
  // FIRST: clean up any mess from a previous crash
  startupCleanup();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  cleanupAll();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  cleanupAll();
});

// ============================================================
// SIGNAL HANDLERS: Catch force-quit signals
// ============================================================
process.on('SIGINT', () => {
  console.log('[ZenoRay] SIGINT received, cleaning up...');
  cleanupAll();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('[ZenoRay] SIGTERM received, cleaning up...');
  cleanupAll();
  process.exit(0);
});

process.on('uncaughtException', (err) => {
  console.error('[ZenoRay] Uncaught exception:', err);
  cleanupAll();
  process.exit(1);
});
