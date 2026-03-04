import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, 
  CheckCircle2, 
  XCircle, 
  ChevronRight, 
  Lock, 
  Cpu, 
  Zap,
  ArrowRight,
  AlertCircle,
  Sparkles,
  Terminal,
  Activity
} from 'lucide-react';
import './SetupWizard.css';

const SetupWizard = ({ onComplete }) => {
  const [step, setStep] = useState(0);
  const [deps, setDeps] = useState({ xray: { found: false }, tun2socks: { found: false } });
  const [checking, setChecking] = useState(true);
  const [installingAdmin, setInstallingAdmin] = useState(false);
  const [adminSuccess, setAdminSuccess] = useState(null);

  useEffect(() => {
    if (step === 1) {
      checkDependencies();
    }
  }, [step]);

  const checkDependencies = async () => {
    setChecking(true);
    try {
      await new Promise(r => setTimeout(r, 800));
      const results = await window.electronAPI.checkDeps();
      setDeps(results);
    } catch {
      console.error('Check deps failed');
    } finally {
      setChecking(false);
    }
  };

  const grantPermission = async () => {
    setInstallingAdmin(true);
    try {
      const success = await window.electronAPI.installAdmin();
      setAdminSuccess(success);
      if (success) {
        setTimeout(() => setStep(3), 1500);
      }
    } catch {
      setAdminSuccess(false);
    } finally {
      setInstallingAdmin(false);
    }
  };

  const finishSetup = async () => {
    try {
      await window.electronAPI.completeSetup();
      onComplete();
    } catch (err) {
      console.error('Complete setup failed:', err);
    }
  };

  const steps = [
    {
      title: "Welcome to ZenoRay",
      subtitle: "The next generation of secure tunneling",
      icon: (
        <div style={{ position: 'relative' }}>
          <Shield size={64} color="#3b82f6" style={{ position: 'relative', zIndex: 10 }} />
          <motion.div 
            animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 4, repeat: Infinity }}
            style={{ 
              position: 'absolute', 
              inset: 0, 
              backgroundColor: 'rgba(59, 130, 246, 0.2)', 
              filter: 'blur(32px)', 
              borderRadius: '50%', 
              transform: 'scale(1.5)' 
            }}
          />
        </div>
      ),
      content: (
        <div className="setup-welcome-text">
          <p>
            Experience lightning-fast speeds and unbreakable privacy. Let's optimize your system for professional performance.
          </p>
          <div className="setup-welcome-features">
             <div className="setup-feature-item"><Zap size={10} /> Fast</div>
             <div className="setup-feature-item"><Lock size={10} /> Secure</div>
             <div className="setup-feature-item"><Sparkles size={10} /> Modern</div>
          </div>
        </div>
      )
    },
    {
      title: "Core Verification",
      subtitle: "Scanning for required system binaries",
      icon: <Cpu size={64} color="#a855f7" />,
      content: (
        <div className="dep-list">
          <div className="dep-item-container">
            <div className="dep-item-blur" style={{ backgroundColor: deps.xray.found ? '#22c55e' : '#ef4444', opacity: 0.2 }} />
            <div className="dep-item">
              <div className="dep-info">
                <div className="dep-icon-box" style={{ backgroundColor: deps.xray.found ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)' }}>
                   <Terminal className={deps.xray.found ? 'text-green-500' : 'text-red-500'} size={20} />
                </div>
                <div>
                  <div className="dep-name">Xray-Core Engine</div>
                  <div className="dep-tag">Essential Binary</div>
                </div>
              </div>
              {checking ? (
                <Activity size={20} color="#64748b" className="animate-pulse" />
              ) : deps.xray.found ? (
                <CheckCircle2 size={22} className="dep-status-icon success" />
              ) : (
                <XCircle size={22} className="dep-status-icon error" />
              )}
            </div>
          </div>

          <div className="dep-item-container">
            <div className="dep-item-blur" style={{ backgroundColor: deps.tun2socks.found ? '#22c55e' : '#3b82f6', opacity: 0.2 }} />
            <div className="dep-item">
              <div className="dep-info">
                <div className="dep-icon-box" style={{ backgroundColor: deps.tun2socks.found ? 'rgba(34, 197, 94, 0.1)' : 'rgba(59, 130, 246, 0.1)' }}>
                   <Activity className={deps.tun2socks.found ? 'text-green-500' : 'text-blue-500'} size={20} />
                </div>
                <div>
                  <div className="dep-name">TUN/TAP Network Bridge</div>
                  <div className="dep-tag">System Level Interface</div>
                </div>
              </div>
              {checking ? (
                <Activity size={20} color="#64748b" className="animate-pulse" />
              ) : deps.tun2socks.found ? (
                <CheckCircle2 size={22} className="dep-status-icon success" />
              ) : (
                <XCircle size={22} className="dep-status-icon warning" />
              )}
            </div>
          </div>

          {!checking && !deps.xray.found && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="dep-error-msg">
              <AlertCircle size={14} />
              <span>Xray binary missing. Check <code style={{ color: '#fca5a5' }}>bin/</code> directory.</span>
            </motion.div>
          )}
        </div>
      )
    },
    {
      title: "Elevated Authority",
      subtitle: "Granting system permissions for networking",
      icon: <Lock size={64} color="#f59e0b" />,
      content: (
        <div className="priv-container">
          <div className="priv-info-box">
             <p>
               For <strong>TUN Mode</strong>, ZenoRay requires permission to modify system routing tables. We use a one-time sudoers entry to avoid future password prompts.
             </p>
          </div>
          {adminSuccess === false && (
            <motion.div initial={{ x: -10, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="priv-error">
              <AlertCircle size={16} />
              <span>Permission failed. You can proceed, but TUN mode will be unavailable.</span>
            </motion.div>
          )}
        </div>
      )
    },
    {
      title: "System Optimized",
      subtitle: "All systems operational and ready",
      icon: (
        <motion.div animate={{ rotate: [0, 5, -5, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}>
          <CheckCircle2 size={80} color="#22c55e" style={{ filter: 'drop-shadow(0 0 15px rgba(34, 197, 94, 0.3))' }} />
        </motion.div>
      ),
      content: (
        <div className="ready-container">
          <div className="ready-grid">
             <div className="ready-item">
                <CheckCircle2 size={12} color="#22c55e" />
                <span>Core Ready</span>
             </div>
             <div className="ready-item">
                <CheckCircle2 size={12} color="#22c55e" />
                <span>Net-Priv Ok</span>
             </div>
          </div>
          <p className="ready-text">
            Final checks completed. Secure tunnel is ready for deployment.
          </p>
        </div>
      )
    }
  ];

  return (
    <div className="setup-wizard-overlay">
      <div className="setup-wizard-bg">
        <div className="setup-wizard-bg-glow-1" />
        <div className="setup-wizard-bg-glow-2" />
        <div className="setup-wizard-bg-grid" />
      </div>

      <div className="setup-wizard-container">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.05, y: -10 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="setup-card"
          >
            <div className="setup-header">
               <div className="setup-icon-wrapper">
                  <div className="setup-icon-outer">
                    <div className="setup-icon-glow" />
                    {steps[step].icon}
                  </div>
               </div>
               
               <div style={{ marginTop: '32px' }}>
                 <h1 className="setup-title">{steps[step].title}</h1>
                 <p className="setup-subtitle">{steps[step].subtitle}</p>
               </div>
            </div>

            <div className="setup-content-area">
              {steps[step].content}
            </div>

            <div className="stepper-dots">
              {steps.map((_, i) => (
                <div key={i} className={`step-dot ${i === step ? 'active' : ''}`} />
              ))}
            </div>

            <div className="button-group">
              {step === 2 && (
                <button onClick={() => setStep(3)} className="btn-secondary">
                  Skip for now
                </button>
              )}

              {step < 3 ? (
                <button
                  disabled={(step === 1 && (checking || !deps.xray.found)) || (step === 2 && installingAdmin)}
                  onClick={() => {
                    if (step === 2) grantPermission();
                    else setStep(step + 1);
                  }}
                  className="btn-primary"
                >
                  {installingAdmin ? (
                    <>
                      <div className="spinner" />
                      Authenticating...
                    </>
                  ) : (
                    <>
                      <span>{step === 2 ? 'Authorize Access' : 'Begin Optimization'}</span>
                      <ArrowRight size={20} />
                    </>
                  )}
                </button>
              ) : (
                <button onClick={finishSetup} className="btn-launch">
                  Launch Terminal
                  <ChevronRight size={22} />
                </button>
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className="footer-credit">
          ZenoRay Security Lab • Project Arvino • v0.1.0
        </motion.p>
      </div>
    </div>
  );
};

export default SetupWizard;
