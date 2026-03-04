# ⚡️ ZenoRay VPN

**ZenoRay** is a premium, high-performance Xray client for macOS. Designed with a state-of-the-art interface and optimized for "Bug" (SNI/Host) connection methods, it provides a seamless and secure tunneling experience.

![ZenoRay Banner](https://raw.githubusercontent.com/ar-vinooo/zenoray-vpn/main/build/icon.png)

## ✨ Features

- 💎 **Premium Interface**: A stunning macOS-native inspired UI with glassmorphism, dynamic gradients, and smooth animations using Framer Motion.
- 🧙 **Setup Wizard**: An intelligent onboarder that checks system dependencies and configures permissions automatically.
- 📦 **Bundled Binaries**: No more manual installations. `xray-core` and `tun2socks` are bundled directly within the app.
- 🛡️ **TUN Mode Support**: Full system-level routing with automatic `sudoers` configuration for a password-less experience.
- 📊 **Real-time Monitoring**: Track your download/upload speeds and connection uptime with a precise dashboard.
- 🐜 **Advanced Bug Tunneling**: Deep integration for Host/SNI "Bug" configuration (VLESS/VMESS) over WS, gRPC, and TLS.
- 🌓 **Themes & Accents**: Fully customizable Dark Mode and accent colors to match your macOS setup.

## 🚀 Quick Start (Development)

Ensure you have [Node.js](https://nodejs.org/) installed, then:

```bash
# Clone the repository
git clone https://github.com/ar-vinooo/zenoray-vpn.git
cd zenoray-vpn

# Install dependencies
npm install

# Setup binaries (Copy your local binaries for dev testing)
mkdir -p bin
cp $(which xray) bin/
cp $(which tun2socks) bin/

# Launch the app
npm run electron
```

## 🛠 Technical Stack

- **Runtime**: [Electron](https://www.electronjs.org/)
- **Frontend**: [React 19](https://react.dev/) + [Vite 7](https://vitejs.dev/)
- **Logic**: Node.js & Shell Scripting
- **Styling**: Vanilla CSS (Custom tokens & Design System)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Animations**: [Framer Motion](https://www.framer.com/motion/)

## 📁 Project Structure

```text
├── bin/                # Bundled system binaries (xray, tun2socks)
├── build/              # Build assets and icons
├── electron-main.cjs   # Main process (System logic & VPN control)
├── preload.cjs         # IPC Bridge
├── src/
│   ├── components/     # UI Components (Setup, Sidebar, Panel)
│   ├── App.jsx         # Main Layout & State management
│   └── index.css       # Core Design System
└── package.json        # Build & Dependency config
```

## 🔐 Security & Permissions

ZenoRay uses a one-time `osascript` authorization to add targeted binary paths to `/etc/sudoers.d/zenoray`. This ensures:

1. **Security**: We only whitelist specific commands for the current user.
2. **UX**: No more annoying password prompts when switching TUN mode on/off.

---

Designed with ❤️ by **ZenoRay Security Lab** • Project Arvino.
