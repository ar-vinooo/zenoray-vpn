import React from "react";
import { motion, AnimatePresence } from "framer-motion";

const ImportModal = ({
  showImportModal,
  setShowImportModal,
  importUrl,
  setImportUrl,
  handleImport
}) => {
  return (
    <AnimatePresence>
      {showImportModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            backdropFilter: "blur(12px)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 10 }}
            style={{
              background: "var(--surface-color)",
              border: "1px solid var(--glass-border)",
              borderRadius: "24px",
              padding: "32px",
              width: "100%",
              maxWidth: "520px",
            }}
          >
            <h3 style={{ marginBottom: "8px", fontSize: "1.1rem" }}>Import Config</h3>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "20px" }}>
              Paste your <strong>vmess://</strong> or <strong>vless://</strong> link:
            </p>
            <textarea
              value={importUrl}
              onChange={(e) => setImportUrl(e.target.value)}
              placeholder="vmess://eyJ2Ij..."
              style={{
                width: "100%",
                height: "110px",
                background: "var(--input-bg)",
                border: "1px solid var(--glass-border)",
                borderRadius: "12px",
                padding: "14px",
                color: "var(--input-color)",
                outline: "none",
                marginBottom: "20px",
                fontSize: "0.8rem",
                fontFamily: "monospace",
                resize: "none",
              }}
            />
            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportUrl("");
                }}
                style={{ background: "none", border: "1px solid var(--glass-border)", color: "var(--text-secondary)", cursor: "pointer", fontSize: "0.85rem", padding: "10px 20px", borderRadius: "10px" }}
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                style={{ background: "var(--primary-color)", color: "white", border: "none", padding: "10px 24px", borderRadius: "10px", fontSize: "0.85rem", fontWeight: "bold", cursor: "pointer" }}
              >
                Import
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ImportModal;
