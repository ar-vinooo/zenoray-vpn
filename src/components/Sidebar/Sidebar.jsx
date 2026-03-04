import React, { useEffect } from "react";
import { 
  Shield, Plus, Download, Zap, Pencil, Trash2, 
  Activity, Sun, Moon
} from "lucide-react";
import { motion } from "framer-motion";

const Sidebar = ({
  setSidebarView,
  isConnected,
  addNewAccount,
  setShowImportModal,
  accounts,
  activeAccountId,
  selectAccount,
  pingResults,
  setPingResults,
  deleteAccount,
  connMode,
  setConnMode,
  tunAvailable,
  addLog,
  xrayFound,
  isSyncing,
  isDark,
  setIsDark,
  accentColor,
  setAccentColor
}) => {
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  useEffect(() => {
    document.documentElement.style.setProperty('--primary-color', accentColor);
  }, [accentColor]);

  // Helper to detect country based on name
  const getFlag = (name = "") => {
    const text = name.toUpperCase();
    if (text.includes("SG") || text.includes("SINGAPORE")) return "🇸🇬";
    if (text.includes("ID") || text.includes("INDONESIA")) return "🇮🇩";
    if (text.includes("US") || text.includes("USA") || text.includes("UNITED STATES")) return "🇺🇸";
    if (text.includes("JP") || text.includes("JAPAN")) return "🇯🇵";
    if (text.includes("HK") || text.includes("HONGKONG")) return "🇭🇰";
    if (text.includes("KR") || text.includes("KOREA")) return "🇰🇷";
    if (text.includes("NL") || text.includes("NETHERLANDS")) return "🇳🇱";
    return "🌐";
  };

  return (
    <motion.aside
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className="sidebar"
    >
      <div className="sidebar-branding">
        <Shield color="var(--primary-color)" size={24} />
        <span>ZenoRay</span>
      </div>
      
      <div className="sidebar-content">
        {/* Xray Status Banner */}
        {xrayFound === false && (
          <div
            style={{
              padding: "8px 12px",
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: "10px",
              marginBottom: "16px",
              fontSize: "0.7rem",
              color: "#ef4444",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <Shield size={16} />
            <span>Xray not found. Run: brew install xray</span>
          </div>
        )}

        <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
          <button
            onClick={addNewAccount}
            disabled={isConnected || isSyncing}
            style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
              padding: "10px", borderRadius: "12px", border: "1px solid var(--glass-border)",
              background: "rgba(139,92,246,0.08)", color: "var(--accent-color)",
              cursor: (isConnected || isSyncing) ? "not-allowed" : "pointer", fontSize: "0.8rem", fontWeight: 600,
              opacity: (isConnected || isSyncing) ? 0.4 : 1,
            }}
          >
            <Plus size={16} /> Add New
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            disabled={isConnected || isSyncing}
            style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
              padding: "10px", borderRadius: "12px", border: "1px solid var(--glass-border)",
              background: "rgba(59,130,246,0.08)", color: "var(--primary-color)",
              cursor: (isConnected || isSyncing) ? "not-allowed" : "pointer", fontSize: "0.8rem", fontWeight: 600,
              opacity: (isConnected || isSyncing) ? 0.4 : 1,
            }}
          >
            <Download size={16} /> Import
          </button>
        </div>

        <span className="section-label">Configs ({accounts.length})</span>

        <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
          <button
            onClick={async () => {
              if (!window.electronAPI || isConnected || isSyncing) return;

              const validAccounts = accounts.filter(acc => acc.server && acc.uuid);
              setPingResults(prev => {
                const next = { ...prev };
                for (const acc of validAccounts) {
                  next[acc.id] = { status: 'testing' };
                }
                return next;
              });

              await Promise.all(
                validAccounts.map(async (acc) => {
                  const tempConfig = {
                    log: { loglevel: "none" },
                    inbounds: [{ port: 10808, listen: "127.0.0.1", protocol: "socks", settings: { auth: "noauth", udp: false } }],
                    outbounds: [{ tag: "proxy", protocol: acc.protocol, settings: { vnext: [{ address: acc.server, port: parseInt(acc.port), users: [acc.protocol === "vless" ? { id: acc.uuid, encryption: "none", flow: "" } : { id: acc.uuid, alterId: parseInt(acc.alterId || "0"), security: "auto" }] }] }, streamSettings: { network: acc.method, security: acc.tls, wsSettings: acc.method === "ws" ? { path: acc.path, headers: { Host: acc.bug || acc.server } } : undefined, grpcSettings: acc.method === "grpc" ? { serviceName: acc.serviceName || "" } : undefined, tlsSettings: acc.tls === "tls" ? { serverName: acc.bug || acc.server, allowInsecure: true } : undefined } }],
                  };
                  const result = await window.electronAPI.pingTest({ configJson: JSON.stringify(tempConfig) });
                  setPingResults(prev => ({
                    ...prev,
                    [acc.id]: result.success
                      ? { status: 'ok', latency: result.latency }
                      : { status: 'fail', error: result.error }
                  }));
                })
              );
            }}
            disabled={isConnected || isSyncing}
            style={{
              flex: 3, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
              padding: "8px", borderRadius: "10px", border: "1px solid var(--glass-border)",
              background: "rgba(16,185,129,0.06)", color: "#10b981",
              cursor: (isConnected || isSyncing) ? "not-allowed" : "pointer", fontSize: "0.65rem", fontWeight: 600,
              opacity: (isConnected || isSyncing) ? 0.3 : 1,
            }}
          >
            <Zap size={12} /> Ping All
          </button>
          
          <button
            onClick={() => {
              const best = Object.entries(pingResults)
                .filter(([, res]) => res.status === 'ok')
                .sort(([, a], [, b]) => a.latency - b.latency)[0];
              
              if (best) {
                const bestId = parseInt(best[0]);
                selectAccount(bestId);
                addLog(`[ZenoRay] Auto-selected fastest server: ${accounts.find(a => a.id === bestId)?.name} (${best[1].latency}ms)`);
              } else {
                alert("Ping all server dulu bang buat cari yang tercepat!");
              }
            }}
            disabled={isConnected || isSyncing || Object.keys(pingResults).length === 0}
            style={{
              flex: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
              padding: "8px", borderRadius: "10px", border: "1px solid var(--glass-border)",
              background: "rgba(139,92,246,0.06)", color: "var(--accent-color)",
              cursor: (isConnected || isSyncing || Object.keys(pingResults).length === 0) ? "not-allowed" : "pointer", 
              fontSize: "0.65rem", fontWeight: 600,
              opacity: (isConnected || isSyncing || Object.keys(pingResults).length === 0) ? 0.3 : 1,
            }}
          >
            <Activity size={12} /> Fast Select
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          {accounts.map((acc) => (
            <div
              key={acc.id}
              onClick={() => {
                selectAccount(acc.id);
                setSidebarView("list"); // When clicking a card, go to dashboard
              }}
              className={`profile-card group ${acc.id === activeAccountId ? "active" : ""}`}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "14px", flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '1.2rem' }}>
                  {getFlag(acc.name)}
                </div>
                
                <div style={{ overflow: "hidden", flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {acc.name}
                  </div>
                  <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginTop: "4px", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {acc.protocol.toUpperCase()} • {acc.server}
                  </div>
                </div>
              </div>

              <div className="card-actions">
                {pingResults[acc.id] && (
                  <span className="ping-badge" style={{
                    fontSize: "0.55rem", fontWeight: 800, padding: "3px 8px", borderRadius: "8px",
                    background: pingResults[acc.id].status === 'ok' ? 'rgba(16,185,129,0.12)' : 
                               pingResults[acc.id].status === 'testing' ? 'rgba(148,163,184,0.1)' : 'rgba(239,68,68,0.08)',
                    color: pingResults[acc.id].status === 'ok' ? '#10b981' : 
                           pingResults[acc.id].status === 'testing' ? 'var(--text-muted)' : '#ef4444',
                    border: `1px solid ${pingResults[acc.id].status === 'ok' ? 'rgba(16,185,129,0.2)' : 
                                       pingResults[acc.id].status === 'testing' ? 'rgba(148,163,184,0.2)' : 'rgba(239,68,68,0.1)'}`,
                    display: "inline-block"
                  }}>
                    {pingResults[acc.id].status === 'ok' ? `${pingResults[acc.id].latency}ms` : 
                     pingResults[acc.id].status === 'testing' ? "..." : "OFF"}
                  </span>
                )}
                
                <div className="hover-buttons">
                  <button
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      selectAccount(acc.id); 
                      setSidebarView("edit"); 
                    }}
                    style={{ padding: "7px", borderRadius: "8px", background: "rgba(255,255,255,0.05)", border: "1px solid var(--glass-border)", cursor: "pointer" }}
                  >
                    <Pencil size={13} color="var(--primary-color)" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteAccount(e, acc.id); }}
                    style={{ padding: "7px", borderRadius: "8px", background: "rgba(255,255,255,0.05)", border: "1px solid var(--glass-border)", cursor: "pointer" }}
                  >
                    <Trash2 size={13} color="#ef4444" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: "auto", paddingTop: "12px" }}>
          {/* Connection Mode Selector */}
          <div style={{ marginBottom: "12px" }}>
            <span className="section-label">Connection Mode</span>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <button
                onClick={() => !(isConnected || isSyncing) && setConnMode("proxy")}
                disabled={isConnected || isSyncing}
                style={{
                  padding: "8px",
                  borderRadius: "10px",
                  border: `1px solid ${connMode === "proxy" ? "var(--primary-color)" : "var(--glass-border)"}`,
                  background: connMode === "proxy" ? "rgba(59,130,246,0.12)" : "rgba(255,255,255,0.02)",
                  color: connMode === "proxy" ? "var(--primary-color)" : "var(--text-muted)",
                  cursor: (isConnected || isSyncing) ? "not-allowed" : "pointer",
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  textAlign: "center",
                  opacity: (isConnected || isSyncing) ? 0.5 : 1,
                }}
              >
                🌐 Proxy
              </button>
              <button
                onClick={() => !(isConnected || isSyncing) && tunAvailable && setConnMode("tun")}
                disabled={isConnected || isSyncing || !tunAvailable}
                style={{
                  padding: "8px",
                  borderRadius: "10px",
                  border: `1px solid ${connMode === "tun" ? "var(--accent-color)" : "var(--glass-border)"}`,
                  background: connMode === "tun" ? "rgba(139,92,246,0.12)" : "rgba(255,255,255,0.02)",
                  color: connMode === "tun" ? "var(--accent-color)" : "var(--text-muted)",
                  cursor: (isConnected || isSyncing || !tunAvailable) ? "not-allowed" : "pointer",
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  textAlign: "center",
                  opacity: (isConnected || isSyncing || !tunAvailable) ? 0.35 : 1,
                }}
              >
                🛡️ TUN
              </button>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "10px 14px",
              background: "var(--card-bg)",
              borderRadius: "10px",
              gap: "10px",
              color: "var(--text-muted)",
              fontSize: "0.62rem",
              marginBottom: "12px"
            }}
          >
            <Activity size={12} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              Xray Core • {connMode === "tun" ? "TUN Mode" : "SOCKS5:1080"}
            </span>
          </div>

          {/* Accent Color Picker + Theme Toggle */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
            <button
              onClick={() => setIsDark(d => !d)}
              title={isDark ? "Light Mode" : "Dark Mode"}
              style={{
                width: "30px", height: "30px", borderRadius: "50%",
                background: "var(--surface-secondary)",
                border: "1px solid var(--glass-border)",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--text-muted)",
              }}
            >
              {isDark ? <Sun size={13} /> : <Moon size={13} />}
            </button>

            <div style={{ width: "1px", height: "16px", background: "var(--glass-border)" }} />

            {[
              { name: "Blue", color: "#3b82f6" },
              { name: "Purple", color: "#8b5cf6" },
              { name: "Pink", color: "#ec4899" },
              { name: "Orange", color: "#f59e0b" },
              { name: "Green", color: "#10b981" }
            ].map(theme => (
              <button
                key={theme.name}
                onClick={() => setAccentColor(theme.color)}
                style={{
                  width: "14px", height: "14px", borderRadius: "50%",
                  background: theme.color, 
                  border: `2px solid ${accentColor === theme.color ? 'var(--text-secondary)' : 'var(--glass-border)'}`,
                  outline: accentColor === theme.color ? `1px solid ${theme.color}` : 'none',
                  outlineOffset: "2px",
                  cursor: "pointer", padding: 0,
                  transition: "all 0.2s ease"
                }}
                title={theme.name}
              />
            ))}
          </div>
        </div>
      </div>
    </motion.aside>
  );
};

export default Sidebar;
