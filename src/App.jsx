import React, { useState, useEffect, useRef } from "react";
import MacOSHeader from "./components/Layout/MacOSHeader";
import Sidebar from "./components/Sidebar/Sidebar";
import MainPanel from "./components/MainPanel/MainPanel";
import ImportModal from "./components/Modals/ImportModal";
import SetupWizard from "./components/Setup/SetupWizard";

const DEFAULT_ACCOUNT = {
  id: 0,
  name: "Default Profile",
  server: "",
  port: "443",
  uuid: "",
  bug: "",
  method: "ws",
  protocol: "vless",
  tls: "tls",
  path: "/",
  sni: "",
  mux: true,
  doh: true,
  fingerprint: "chrome",
  udp: true,
  adblock: true,
};

const ZenoRay = () => {
  // ============ Connection State ============
  const [isConnected, setIsConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [xrayFound, setXrayFound] = useState(!window.electronAPI ? true : null);
  const [tunAvailable, setTunAvailable] = useState(false);
  const [connMode, setConnMode] = useState("proxy"); // 'proxy' | 'tun'
  const [isDark, setIsDark] = useState(true);
  const [accentColor, setAccentColor] = useState("#3b82f6");
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [setupComplete, setSetupComplete] = useState(null);

  // ============ UI State ============
  const [showImportModal, setShowImportModal] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [logs, setLogs] = useState(["[ZenoRay] Idle. Ready to connect."]);
  const logRef = useRef(null);
  const [sidebarView, setSidebarView] = useState("list"); // 'list' | 'edit' | 'raw'
  const [pingResults, setPingResults] = useState({}); // { accountId: { latency, status } }

  // ============ Accounts ============
  const [accounts, setAccounts] = useState([DEFAULT_ACCOUNT]);

  const [activeAccountId, setActiveAccountId] = useState(DEFAULT_ACCOUNT.id);

  // ============ Helpers ============
  const formatUptime = (s) => {
    const h = String(Math.floor(s / 3600)).padStart(2, "0");
    const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
    const sec = String(s % 60).padStart(2, "0");
    return `${h}:${m}:${sec}`;
  };

  const addLog = (msg) => {
    const time = new Date().toLocaleTimeString("en-GB", { hour12: false });
    setLogs((prev) => [`[${time}] ${msg}`, ...prev].slice(0, 100));
  };

  // ============ Check Setup Status ============
  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.checkSetupStatus().then((complete) => {
        setSetupComplete(complete);
      });
    } else {
      setTimeout(() => setSetupComplete(true), 0);
    }
  }, []);

  // ============ Load/Save settings (JSON via Electron API) ============
  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.getSettings().then((s) => {
        setTimeout(() => {
          if (s) {
            if (s.accounts) setAccounts(s.accounts);
            if (s.activeAccountId !== undefined) setActiveAccountId(s.activeAccountId);
            if (s.connMode) setConnMode(s.connMode);
            if (s.theme) setIsDark(s.theme !== "light");
            if (s.accentColor) setAccentColor(s.accentColor);
          } else {
            // New app — generate a real unique ID for the default account
            const defaultId = Date.now();
            setAccounts([{ ...DEFAULT_ACCOUNT, id: defaultId }]);
            setActiveAccountId(defaultId);
          }
          setSettingsLoaded(true);
        }, 0);
      });
    } else {
      setTimeout(() => setSettingsLoaded(true), 0);
    }
  }, []);

  useEffect(() => {
    if (settingsLoaded && window.electronAPI) {
      window.electronAPI.saveSettings({
        accounts,
        activeAccountId,
        connMode,
        theme: isDark ? "dark" : "light",
        accentColor,
      });
    }
  }, [accounts, activeAccountId, connMode, isDark, accentColor, settingsLoaded]);

  const config = accounts.find((a) => a.id === activeAccountId) || accounts[0];

  // ============ Stats (Real-time monitoring) ============
  const [stats, setStats] = useState({
    download: "0.00 KB/s",
    upload: "0.00 KB/s",
    ping: "—",
    uptime: "00:00:00",
  });
  const uptimeRef = useRef(0);

  // ============ Check Dependencies on Load ============
  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.checkDeps().then((deps) => {
        setXrayFound(deps.xray.found);
        setTunAvailable(deps.tun2socks.found);
        if (deps.xray.found) {
          addLog(`[ZenoRay] Xray found: ${deps.xray.path}`);
        } else {
          addLog("[ZenoRay] ⚠ Xray NOT found. Install: brew install xray");
        }
        if (deps.tun2socks.found) {
          addLog(`[ZenoRay] tun2socks found: ${deps.tun2socks.path} (TUN mode available)`);
        } else {
          addLog("[ZenoRay] tun2socks not found. TUN mode disabled.");
        }
      });

      window.electronAPI.onVpnStatus((status) => {
        setIsConnected(status.connected);
        setIsSyncing(false);
        if (!status.connected && status.error) {
          addLog(`[ZenoRay] Error: ${status.error}`);
        }
      });

      window.electronAPI.onXrayLog((log) => {
        addLog(log.trim());
      });

      window.electronAPI.onVpnStats((data) => {
        const formatSpeed = (bytes) => {
          if (bytes < 1024) return `${bytes} B/s`;
          if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB/s`;
          return `${(bytes / (1024 * 1024)).toFixed(2)} MB/s`;
        };

        setStats((p) => ({
          ...p,
          download: formatSpeed(data.down),
          upload: formatSpeed(data.up),
          ...(data.ip ? { ping: data.ip } : {}),
        }));
      });

      return () => {
        window.electronAPI.removeAllListeners();
      };
    }
  }, []);

  // Stats reset and uptime timer
  useEffect(() => {
    let timer = null;
    if (isConnected) {
      uptimeRef.current = 0;
      timer = setInterval(() => {
        uptimeRef.current += 1;
        setStats((p) => ({ ...p, uptime: formatUptime(uptimeRef.current) }));
      }, 1000);
    } else {
      setTimeout(() => {
        setStats({ download: "0.00 KB/s", upload: "0.00 KB/s", ping: "—", uptime: "00:00:00" });
      }, 0);
      if (timer) clearInterval(timer);
    }
    return () => { if (timer) clearInterval(timer); };
  }, [isConnected]);

  const updateCurrentAccount = (updates) => {
    setAccounts((prev) =>
      prev.map((acc) =>
        acc.id === activeAccountId ? { ...acc, ...updates } : acc
      )
    );
  };

  const addNewAccount = () => {
    const newAcc = {
      id: Date.now(),
      name: `Profile ${accounts.length + 1}`,
      server: "",
      port: "443",
      uuid: "",
      bug: "",
      method: "ws",
      protocol: "vless",
      tls: "tls",
      path: "/",
      sni: "",
      mux: true,
      doh: true,
      fingerprint: "chrome",
      udp: true,
      adblock: true,
    };
    setAccounts([...accounts, newAcc]);
    setActiveAccountId(newAcc.id);
  };

  const deleteAccount = (e, id) => {
    e.stopPropagation();
    if (accounts.length === 1) return;
    const newAccounts = accounts.filter((acc) => acc.id !== id);
    setAccounts(newAccounts);
    if (activeAccountId === id) setActiveAccountId(newAccounts[0].id);
  };

  // ============ Import Config ============
  const handleImport = () => {
    const url = importUrl.trim();
    if (!url) return;

    try {
      if (url.startsWith("vmess://")) {
        const base64 = url.replace("vmess://", "");
        const decoded = JSON.parse(atob(base64));
        const newAcc = {
          id: Date.now(),
          name: decoded.ps || "Imported VMess",
          server: decoded.add,
          port: decoded.port.toString(),
          uuid: decoded.id,
          bug: decoded.host || decoded.add,
          method: decoded.net || "ws",
          protocol: "vmess",
          tls: decoded.tls || "none",
          path: decoded.path || "/",
          sni: decoded.sni || decoded.host || "",
          mux: true,
          doh: true,
          fingerprint: "chrome",
          udp: true,
          adblock: true,
        };
        setAccounts([...accounts, newAcc]);
        setActiveAccountId(newAcc.id);
        addLog(`[Import] VMess profile "${newAcc.name}" imported.`);
      } else if (url.startsWith("vless://")) {
        const urlObj = new URL(url);
        const params = new URLSearchParams(urlObj.search);
        const newAcc = {
          id: Date.now(),
          name: decodeURIComponent(urlObj.hash.replace("#", "")) || "Imported VLESS",
          server: urlObj.hostname,
          port: urlObj.port || "443",
          uuid: urlObj.username,
          bug: params.get("host") || params.get("sni") || urlObj.hostname,
          method: params.get("type") || "ws",
          protocol: "vless",
          tls: "tls",
          path: params.get("path") || "/",
          sni: params.get("sni") || "",
          mux: true,
          doh: true,
          fingerprint: "chrome",
          udp: true,
          adblock: true,
        };
        setAccounts([...accounts, newAcc]);
        setActiveAccountId(newAcc.id);
        addLog(`[Import] VLESS profile "${newAcc.name}" imported.`);
      } else {
        alert("Format tidak didukung. Gunakan vmess:// atau vless://");
        return;
      }
      setShowImportModal(false);
      setImportUrl("");
    } catch (e) {
      alert("Gagal parse config: " + e.message);
    }
  };

  const generateXrayConfig = (targetAcc = null) => {
    const acc = targetAcc || accounts.find((a) => a.id === activeAccountId) || accounts[0];
    const configData = {
      log: { loglevel: "warning" },
      stats: {},
      api: { tag: "api", services: ["StatsService"] },
      policy: {
        levels: { "0": { statsUserUplink: true, statsUserDownlink: true, handshake: 4, connIdle: 300, uploadCheck: 1, multicast: false } },
        system: { statsOutboundUplink: true, statsOutboundDownlink: true }
      },
      dns: {
        servers: acc.doh ? ["https://1.1.1.1/dns-query", "8.8.8.8", { address: "127.0.0.1", port: 53, domains: ["localhost"] }] : ["8.8.8.8", "1.1.1.1"]
      },
      inbounds: [
        { tag: "socks-in", port: 1080, listen: "127.0.0.1", protocol: "socks", settings: { auth: "noauth", udp: acc.udp }, sniffing: { enabled: true, destOverride: ["http", "tls", "quic"], metadataOnly: false } },
        { tag: "http-in", port: 1081, listen: "127.0.0.1", protocol: "http", sniffing: { enabled: true, destOverride: ["http", "tls", "quic"] } },
        { listen: "127.0.0.1", port: 10085, protocol: "dokodemo-door", settings: { address: "127.0.0.1" }, tag: "api" }
      ],
      outbounds: [
        {
          tag: "proxy",
          protocol: acc.protocol,
          settings: {
            vnext: [{ address: acc.server, port: parseInt(acc.port), users: [acc.protocol === "vless" ? { id: acc.uuid, encryption: "none", flow: "" } : { id: acc.uuid, alterId: parseInt(acc.alterId || "0"), security: "auto" }] }]
          },
          streamSettings: {
            network: acc.method,
            security: acc.tls,
            wsSettings: acc.method === "ws" ? { path: acc.path, headers: { Host: acc.bug || acc.server } } : undefined,
            grpcSettings: acc.method === "grpc" ? { serviceName: acc.serviceName || "" } : undefined,
            tlsSettings: acc.tls === "tls" ? { serverName: acc.sni || acc.bug || acc.server, allowInsecure: true, fingerprint: acc.fingerprint || "chrome" } : undefined
          },
          mux: { enabled: acc.mux, concurrency: 8 }
        },
        { protocol: "freedom", tag: "direct" },
        { protocol: "blackhole", tag: "block" }
      ],
      routing: {
        domainStrategy: "AsIs",
        rules: [
          { type: "field", inboundTag: ["api"], outboundTag: "api" },
          { type: "field", outboundTag: "direct", domain: ["geosite:private", "geosite:cn", "domain:localhost"] },
          acc.adblock ? { type: "field", outboundTag: "block", domain: ["geosite:category-ads-all"] } : null
        ].filter(Boolean)
      }
    };
    return JSON.stringify(configData, null, 2);
  };

  const toggleConnection = async () => {
    if (isSyncing) return;
    setIsSyncing(true);

    if (isConnected) {
      addLog("[ZenoRay] Disconnecting...");
      if (window.electronAPI) {
        const result = await window.electronAPI.disconnect({ serverIP: config.server });
        if (result.success) {
          setIsConnected(false);
          addLog("[ZenoRay] Disconnected. Network restored.");
        }
      } else {
        setTimeout(() => setIsConnected(false), 800);
      }
      setIsSyncing(false);
    } else {
      if (!config.server || !config.uuid) {
        alert("Server dan UUID harus diisi!");
        setIsSyncing(false);
        return;
      }

      addLog(`[ZenoRay] Connecting [${connMode.toUpperCase()} MODE] to ${config.server}:${config.port}...`);
      const configJson = generateXrayConfig();

      if (window.electronAPI) {
        const result = await window.electronAPI.connect({ configJson, mode: connMode, serverIP: config.server });
        if (result.success) {
          setIsConnected(true);
          addLog(`[ZenoRay] ✓ ${result.message}`);
        } else {
          addLog(`[ZenoRay] ✗ Failed: ${result.error}`);
          alert(result.error);
        }
      } else {
        setTimeout(() => {
          setIsConnected(true);
          addLog("[ZenoRay] ✓ Connected (Browser Mock)");
        }, 1500);
      }
      setIsSyncing(false);
    }
  };

  const selectAccount = async (id) => {
    if (activeAccountId === id || isSyncing) return;

    if (isConnected) {
      setIsSyncing(true);
      const currentAcc = accounts.find(a => a.id === activeAccountId);
      const newAcc = accounts.find(a => a.id === id);
      
      addLog(`[ZenoRay] Switching to ${newAcc.name}. Reconnecting...`);
      
      if (window.electronAPI) {
        await window.electronAPI.disconnect({ serverIP: currentAcc.server });
        setIsConnected(false);
        setActiveAccountId(id);
        
        const configJson = generateXrayConfig(newAcc);
        const result = await window.electronAPI.connect({ 
          configJson, 
          mode: connMode, 
          serverIP: newAcc.server 
        });
        
        if (result.success) {
          setIsConnected(true);
          addLog(`[ZenoRay] Switched to ${newAcc.name} successfully.`);
        } else {
          addLog(`[ZenoRay] Switch failed: ${result.error}`);
        }
      }
      setIsSyncing(false);
    } else {
      setActiveAccountId(id);
    }
  };

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = 0;
  }, [logs]);



  if (setupComplete === false) {
    return <SetupWizard onComplete={() => setSetupComplete(true)} />;
  }

  return (
    <div className="app-layout">
      <MacOSHeader />
      <div className="app-container">
        <Sidebar 
          sidebarView={sidebarView} setSidebarView={setSidebarView} isConnected={isConnected}
          addNewAccount={addNewAccount} setShowImportModal={setShowImportModal}
          accounts={accounts} activeAccountId={activeAccountId} selectAccount={selectAccount}
          pingResults={pingResults} setPingResults={setPingResults} deleteAccount={deleteAccount}
          updateCurrentAccount={updateCurrentAccount} config={config} connMode={connMode}
          setConnMode={setConnMode} tunAvailable={tunAvailable} generateXrayConfig={generateXrayConfig}
          addLog={addLog} xrayFound={xrayFound} isSyncing={isSyncing}
          isDark={isDark} setIsDark={setIsDark} accentColor={accentColor} setAccentColor={setAccentColor}
        />
        <MainPanel 
          isConnected={isConnected} isSyncing={isSyncing} config={config}
          toggleConnection={toggleConnection} stats={stats} logRef={logRef} logs={logs}
          sidebarView={sidebarView} setSidebarView={setSidebarView}
          updateCurrentAccount={updateCurrentAccount} generateXrayConfig={generateXrayConfig}
          addLog={addLog}
        />
      </div>
      <ImportModal 
        showImportModal={showImportModal} setShowImportModal={setShowImportModal}
        importUrl={importUrl} setImportUrl={setImportUrl} handleImport={handleImport}
      />
    </div>
  );
};

export default ZenoRay;
