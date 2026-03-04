import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Activity, Power, MapPin, Wifi, Terminal, 
  ChevronLeft, Code, Zap, Shield, Trash2, Copy
} from "lucide-react";

const MainPanel = ({
  isConnected,
  isSyncing,
  config,
  toggleConnection,
  stats,
  logRef,
  logs,
  sidebarView,
  setSidebarView,
  updateCurrentAccount,
  generateXrayConfig,
  addLog
}) => {
  // Speed history for graph
  const [speedHistory, setSpeedHistory] = React.useState(new Array(30).fill(0));

  React.useEffect(() => {
    if (!isConnected) {
      setSpeedHistory(new Array(30).fill(0));
      return;
    }
    const speedStr = stats.download.split(" ")[0];
    const isMB = stats.download.includes("MB");
    const numericSpeed = parseFloat(speedStr) * (isMB ? 1024 : 1);
    
    setSpeedHistory(prev => [...prev.slice(1), numericSpeed]);
  }, [stats.download, isConnected]);

  const renderDashboard = () => (
    <div className="main-scroll-area">
      <div className="glow-background" />

      {/* Status Text */}
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '4px' }}>{isConnected ? "PROTECTED" : "DISCONNECTED"}</h1>
        <p className="subtitle" style={{ fontSize: '0.85rem', marginBottom: '20px' }}>
          {isSyncing
            ? isConnected
              ? "Disconnecting..."
              : "Establishing secure tunnel..."
            : isConnected
            ? `Encrypted tunnel via ${config.bug || config.server}`
            : "Press power to connect"}
        </p>
      </motion.div>

      {/* Power Button */}
      <div className="status-indicator">
        <AnimatePresence>
          {isConnected && (
            <>
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="status-pulse"
                style={{ borderColor: "var(--primary-color)" }}
              />
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1.1, opacity: 0.5 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="status-pulse"
                style={{ animationDelay: "0.5s", borderColor: "var(--accent-color)" }}
              />
            </>
          )}
        </AnimatePresence>
        <button className="power-btn" onClick={toggleConnection} disabled={isSyncing}>
          {isSyncing ? (
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
              <Activity size={40} />
            </motion.div>
          ) : (
            <Power size={48} strokeWidth={2.5} />
          )}
        </button>
      </div>

      {/* Stats Grid Container */}
      <div style={{ width: "420px" }}>
        
        {/* Real-time Speed Graph */}
        <div style={{ 
          height: "90px", 
          width: "100%", 
          background: "var(--graph-bg)", 
          borderRadius: "20px", 
          marginBottom: "16px",
          border: "1px solid var(--glass-border)",
          overflow: "hidden",
          position: "relative",
          display: "flex",
          alignItems: "flex-end",
          padding: "10px",
          backdropFilter: "blur(10px)"
        }}>
          <div style={{ 
            position: "absolute", 
            top: "10px", 
            left: "14px", 
            fontSize: "0.6rem", 
            color: isConnected ? "var(--primary-color)" : "var(--text-muted)", 
            fontWeight: 800, 
            display: "flex", 
            alignItems: "center", 
            gap: "6px",
            letterSpacing: "0.5px"
          }}>
             <Activity size={10} /> {isConnected ? "LIVE NETWORK TRAFFIC" : "SENSOR IDLE"}
          </div>
          
          <div style={{ display: "flex", alignItems: "flex-end", gap: "3px", width: "100%", height: "45px" }}>
            {speedHistory.map((val, i) => {
              const max = Math.max(...speedHistory, 500);
              const height = (val / max) * 100;
              return (
                <motion.div
                  key={i}
                  animate={{ height: `${Math.max(height, 4)}%` }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  style={{
                    flex: 1,
                    background: isConnected 
                      ? "linear-gradient(to top, var(--primary-color), var(--accent-color))" 
                      : "var(--scrollbar-color)",
                    borderRadius: "4px",
                    opacity: 0.2 + (i / 30) * 0.8
                  }}
                />
              );
            })}
          </div>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Download</div>
            <div className="stat-value">{stats.download}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Upload</div>
            <div className="stat-value">{stats.upload}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Public IP</div>
            <div className="stat-value" style={{ 
              fontSize: stats.ping.length > 15 ? '0.7rem' : '1.1rem',
              color: isConnected ? "var(--primary-color)" : "inherit"
            }}>
              {stats.ping}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Uptime</div>
            <div className="stat-value">{stats.uptime}</div>
          </div>
        </div>
      </div>

      {/* Server Info Bar */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ marginTop: "16px", marginBottom: "16px", display: "flex", gap: "24px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--text-secondary)" }}>
          <MapPin size={14} />
          <span style={{ fontSize: "0.75rem" }}>{config.server || "—"}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--text-secondary)" }}>
          <Wifi size={14} />
          <span style={{ fontSize: "0.75rem" }}>{config.protocol.toUpperCase()} + {config.method.toUpperCase()}</span>
        </div>
      </motion.div>

      {/* SYSTEM LOG */}
      <div
        style={{
          marginTop: "auto",
          width: "100%",
          background: "var(--log-bg)",
          borderRadius: "12px",
          padding: "10px 14px",
          border: "1px solid var(--glass-border)",
          display: "flex",
          flexDirection: "column",
          maxHeight: "110px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px", color: "var(--primary-color)", fontWeight: "bold", fontSize: "0.6rem", flexShrink: 0 }}>
          <Terminal size={10} /> SYSTEM LOG
        </div>
        <div
          ref={logRef}
          style={{
            overflowY: "auto",
            fontSize: "0.65rem",
            color: "var(--text-muted)",
            fontFamily: "'SF Mono', 'Fira Code', monospace",
            lineHeight: 1.5,
            flex: 1,
          }}
        >
          {logs.map((log, i) => (
            <div key={i} style={{ opacity: i === 0 ? 1 : 0.6 }}>
              {log}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderEdit = () => (
    <motion.div 
      initial={{ x: 20, opacity: 0 }} 
      animate={{ x: 0, opacity: 1 }} 
      className="main-scroll-area"
      style={{ padding: '32px 24px' }}
    >
      <div style={{ width: '100%', maxWidth: '800px' }}>
        <button
          onClick={() => setSidebarView("list")}
          style={{ background: "none", border: "none", color: "var(--primary-color)", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", fontSize: "0.9rem", marginBottom: "24px", padding: 0 }}
        >
          <ChevronLeft size={20} /> Back to Dashboard
        </button>

        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '20px' }}>Edit: <span style={{ color: 'var(--primary-color)' }}>{config.name}</span></h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div className="input-group">
            <label>Profile Name</label>
            <input type="text" value={config.name} onChange={(e) => updateCurrentAccount({ name: e.target.value })} disabled={isConnected || isSyncing} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <div className="input-group">
              <label>Protocol</label>
              <select className="select-input" value={config.protocol} onChange={(e) => updateCurrentAccount({ protocol: e.target.value })} disabled={isConnected || isSyncing}>
                <option value="vless">VLESS</option>
                <option value="vmess">VMess</option>
              </select>
            </div>
            <div className="input-group">
              <label>Transport</label>
              <select className="select-input" value={config.method} onChange={(e) => updateCurrentAccount({ method: e.target.value })} disabled={isConnected || isSyncing}>
                <option value="ws">WS</option>
                <option value="grpc">gRPC</option>
                <option value="tcp">TCP</option>
              </select>
            </div>
          </div>

          <div className="input-group">
            <label>Server Address</label>
            <input type="text" value={config.server} onChange={(e) => updateCurrentAccount({ server: e.target.value })} placeholder="host.server.com" disabled={isConnected || isSyncing} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <div className="input-group">
              <label>Port</label>
              <input type="number" value={config.port} onChange={(e) => updateCurrentAccount({ port: e.target.value })} disabled={isConnected || isSyncing} />
            </div>
            <div className="input-group">
              <label>TLS</label>
              <select className="select-input" value={config.tls} onChange={(e) => updateCurrentAccount({ tls: e.target.value })} disabled={isConnected || isSyncing}>
                <option value="tls">Enabled</option>
                <option value="none">Disabled</option>
              </select>
            </div>
          </div>

          <div className="input-group">
            <label>UUID / ID</label>
            <input type="text" value={config.uuid} onChange={(e) => updateCurrentAccount({ uuid: e.target.value })} placeholder="xxxxxxxx-xxxx-xxxx-xxxx" disabled={isConnected || isSyncing} />
          </div>

          <div className="input-group">
            <label>SNI</label>
            <input type="text" value={config.sni} onChange={(e) => updateCurrentAccount({ sni: e.target.value })} placeholder="sni.server.com" disabled={isConnected || isSyncing} />
          </div>

          <div className="input-group">
            <label>Bug / Host Header</label>
            <input type="text" value={config.bug} onChange={(e) => updateCurrentAccount({ bug: e.target.value })} placeholder="e.g. v1.whatsapp.net" disabled={isConnected || isSyncing} />
          </div>

          <div className="input-group">
            <label>{config.method === "grpc" ? "Service Name" : "WS Path"}</label>
            <input type="text" value={config.path} onChange={(e) => updateCurrentAccount({ path: e.target.value })} placeholder={config.method === "grpc" ? "svcname" : "/path"} disabled={isConnected || isSyncing} />
          </div>
        </div>

        {/* Turbo Optimization Panel */}
        <div style={{ 
          marginTop: "24px", 
          padding: "16px 20px", 
          background: "var(--card-bg)", 
          borderRadius: "16px", 
          border: "1px solid var(--glass-border)",
          boxShadow: "0 8px 32px var(--power-shadow)"
        }}>
          <div style={{ 
            fontSize: "0.75rem", 
            fontWeight: 800, 
            color: "var(--primary-color)", 
            marginBottom: "14px", 
            display: "flex", 
            alignItems: "center", 
            gap: "8px",
            letterSpacing: "0.5px"
          }}>
            <Zap size={14} fill="var(--primary-color)" /> TURBO OPTIMIZATION
          </div>
          
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            {[
              { id: 'mux', label: 'Multiplex (Mux)', icon: <Zap size={14} color="#fbbf24" />, prop: 'mux' },
              { id: 'udp', label: 'UDP Support', icon: <Activity size={14} color="#10b981" />, prop: 'udp' },
              { id: 'doh', label: 'DNS over HTTPS', icon: <Shield size={14} color="var(--primary-color)" />, prop: 'doh' },
              { id: 'adblock', label: 'Ad Blocker', icon: <Trash2 size={14} color="#ef4444" />, prop: 'adblock' }
            ].map((item) => (
              <div key={item.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "var(--surface-secondary)", borderRadius: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  {item.icon}
                  <span style={{ fontSize: "0.75rem", fontWeight: 500 }}>{item.label}</span>
                </div>
                <label className="switch">
                  <input type="checkbox" checked={config[item.prop]} onChange={(e) => updateCurrentAccount({ [item.prop]: e.target.checked })} disabled={isConnected || isSyncing} />
                  <span className="slider round"></span>
                </label>
              </div>
            ))}
          </div>
          
          <div className="input-group" style={{ marginTop: "14px", marginBottom: 0 }}>
            <label style={{ fontSize: "0.65rem" }}>Fingerprint (Anti-Detect)</label>
            <select className="select-input" value={config.fingerprint} onChange={(e) => updateCurrentAccount({ fingerprint: e.target.value })} disabled={isConnected || isSyncing} style={{ padding: "10px", background: "var(--input-bg)", fontSize: "0.75rem" }}>
              <option value="chrome">Google Chrome</option>
              <option value="firefox">Mozilla Firefox</option>
              <option value="safari">Apple Safari</option>
              <option value="edge">Microsoft Edge</option>
              <option value="none">No Fingerprint</option>
            </select>
          </div>
        </div>

        <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
          <button
            onClick={() => setSidebarView("raw")}
            style={{
              flex: 1, padding: "14px", borderRadius: "14px",
              border: "1px solid var(--glass-border)", background: "rgba(139,92,246,0.08)",
              color: "var(--accent-color)", cursor: "pointer", fontSize: "0.9rem",
              fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
            }}
          >
            <Code size={18} /> View Raw JSON
          </button>
        </div>
      </div>
    </motion.div>
  );

  const renderRaw = () => (
    <motion.div 
      initial={{ scale: 0.98, opacity: 0 }} 
      animate={{ scale: 1, opacity: 1 }} 
      className="main-scroll-area"
      style={{ padding: '32px 24px' }}
    >
      <div style={{ width: '100%', maxWidth: '800px' }}>
        <button
          onClick={() => setSidebarView("edit")}
          style={{ background: "none", border: "none", color: "var(--primary-color)", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", fontSize: "0.85rem", marginBottom: "20px", padding: 0 }}
        >
          <ChevronLeft size={18} /> Back to Editor
        </button>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Raw Config JSON</h2>
          <button
            onClick={() => {
              navigator.clipboard.writeText(generateXrayConfig());
              if (addLog) addLog("[ZenoRay] Config JSON copied to clipboard.");
            }}
            style={{ background: "rgba(59,130,246,0.1)", border: "none", color: "var(--primary-color)", cursor: "pointer", padding: "8px 16px", borderRadius: "10px", display: "flex", alignItems: 'center', gap: '8px', fontSize: '0.75rem', fontWeight: 600 }}
          >
            <Copy size={14} /> Copy
          </button>
        </div>

        <pre
          style={{
            background: "var(--log-bg)",
            border: "1px solid var(--glass-border)",
            borderRadius: "16px",
            padding: "20px",
            fontSize: "0.75rem",
            color: "var(--text-secondary)",
            fontFamily: "'SF Mono', 'Fira Code', monospace",
            overflow: "auto",
            maxHeight: "calc(100vh - 200px)",
            lineHeight: 1.5,
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
          }}
        >
          {generateXrayConfig()}
        </pre>
      </div>
    </motion.div>
  );

  return (
    <main className={`main-content ${isConnected ? "connected" : ""}`}>
      <AnimatePresence mode="wait">
        {sidebarView === "list" ? renderDashboard() : 
         sidebarView === "edit" ? renderEdit() : 
         renderRaw()}
      </AnimatePresence>
    </main>
  );
};

export default MainPanel;
