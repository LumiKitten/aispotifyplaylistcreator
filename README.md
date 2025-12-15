# AI Spotify Playlist Creator

A client-side web app that uses **AI (via OpenRouter)** to generate personalized Spotify playlists. Create playlists from text prompts or remix existing ones.

![Screenshot](https://img.shields.io/badge/Status-Live-brightgreen)

## ✨ Features

- **🎵 AI Playlist Generation** - Describe a mood, theme, or genre and get track suggestions
- **🔄 Remix Mode** - Paste a Spotify playlist URL to get similar/enhanced recommendations
- **🔍 Web Search** - Enable real-time web data for current music trends
- **▶️ Track Previews** - Listen to 30-second clips before adding
- **💾 Save to Spotify** - One-click save directly to your account
- **🔐 Secure Export/Import** - AES-256 encrypted profile backup

## 🚀 Live Demo

Visit: **[Your GitHub Pages URL]**

## 📋 Setup

### 1. Get API Keys

- **Spotify Client ID**: Create an app at [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)
  - Add your redirect URI (e.g., `https://yourusername.github.io/spotifyplaylistcreator/`)
- **OpenRouter API Key**: Get one at [openrouter.ai/keys](https://openrouter.ai/keys)

### 2. Configure the App

1. Click the ⚙️ Settings icon
2. Enter your Spotify Client ID
3. Enter your OpenRouter API Key
4. Choose an AI model (free options available!)
5. Click Save

### 3. Connect & Create

1. Click "Connect Spotify" and authorize
2. Type a prompt or click a suggestion chip
3. Review the AI-suggested tracks
4. Click "Save to Spotify" to add to your account

## 🔒 Security Notes

This is a **client-side only** application. Your API keys are:

- Stored **only in your browser's localStorage**
- **Never sent to any server** except the official API endpoints
- Protected with **AES-256-GCM encryption** when exported

> ⚠️ **Important**: Since this runs entirely in your browser, anyone with access to your browser can see your stored API keys. Use the "Export Profile" feature to backup and clear your keys when needed.

## 🛠️ Tech Stack

- Vanilla HTML, CSS, JavaScript (no frameworks)
- Spotify Web API with PKCE OAuth (no backend needed)
- OpenRouter AI API
- Web Crypto API for encryption

## 📁 Files

| File         | Purpose                                           |
| ------------ | ------------------------------------------------- |
| `index.html` | Main layout, modals, loading overlay              |
| `styles.css` | Dark theme, glassmorphism, animations             |
| `app.js`     | OAuth, AI integration, encryption, playlist logic |

## 🤝 Contributing

Feel free to open issues or submit PRs!

## 📄 License

MIT License - feel free to use and modify!
