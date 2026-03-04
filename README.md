# ZenoRay (ZenoVPN)

A premium Xray client UI designed for macOS, optimized for "Bug" (SNI/Host) connection methods.

## Features

- **Modern UI**: Dark mode with glassmorphism effects.
- **Bug Integration**: Easy Host/SNI configuration for VLESS/VMESS.
- **Real-time Stats**: Connection status and throughput monitoring.
- **Method Selector**: Support for WS, TLS, and gRPC.

## How to use

1. **Run UI**:
   ```bash
   npm install
   npm run dev
   ```
2. **Infrastructure**:
   To connect this UI to a real Xray engine on your Mac:
   - Install Xray via Homebrew: `brew install xray`
   - Use the generated config (visible in the app console) and save it to `config.json`.
   - Run `xray -c config.json`.

## Configuration for "Bug"

- **Host Bug**: Used in WebSocket (WS) headers. Set "Bug" to your host (e.g., `v.whatsapp.net`).
- **SNI Bug**: Used in TLS Server Name Indication.

## Technical Stack

- **Framework**: Vite + React
- **Icons**: Lucide React
- **Animations**: Framer Motion
- **Styling**: Vanilla CSS (Custom Design System)

Designed with ❤️ for premium performance.
