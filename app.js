// ===== Configuration & State =====
const SPOTIFY_AUTH_URL = "https://accounts.spotify.com/authorize";
const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_API_URL = "https://api.spotify.com/v1";
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const REDIRECT_URI = window.location.origin + window.location.pathname;
const SCOPES = [
  "playlist-modify-public",
  "playlist-modify-private",
  "playlist-read-private",
  "user-read-private",
].join(" ");

const state = {
  spotifyToken: null,
  spotifyTokenExpiry: null,
  spotifyUser: null,
  currentMode: "generate",
  playlistTracks: [],
  currentAudio: null,
  currentPlayingTrack: null,
};

// ===== DOM Elements =====
const elements = {
  settingsBtn: document.getElementById("settingsBtn"),
  settingsModal: document.getElementById("settingsModal"),
  closeSettings: document.getElementById("closeSettings"),
  saveSettings: document.getElementById("saveSettings"),
  spotifyClientId: document.getElementById("spotifyClientId"),
  openrouterKey: document.getElementById("openrouterKey"),
  aiModel: document.getElementById("aiModel"),
  webSearchToggle: document.getElementById("webSearchToggle"),
  exportProfileBtn: document.getElementById("exportProfileBtn"),
  importProfileBtn: document.getElementById("importProfileBtn"),
  importFileInput: document.getElementById("importFileInput"),
  authBtn: document.getElementById("authBtn"),
  authText: document.getElementById("authText"),
  newChatBtn: document.getElementById("newChatBtn"),
  modeBtns: document.querySelectorAll(".mode-btn"),
  chatContainer: document.getElementById("chatContainer"),
  remixInput: document.getElementById("remixInput"),
  promptInput: document.getElementById("promptInput"),
  playlistUrl: document.getElementById("playlistUrl"),
  promptText: document.getElementById("promptText"),
  generateBtn: document.getElementById("generateBtn"),
  trackList: document.getElementById("trackList"),
  trackCount: document.getElementById("trackCount"),
  playlistName: document.getElementById("playlistName"),
  savePlaylistBtn: document.getElementById("savePlaylistBtn"),
  searchInput: document.getElementById("searchInput"),
  searchResults: document.getElementById("searchResults"),
  loadingOverlay: document.getElementById("loadingOverlay"),
  loadingText: document.getElementById("loadingText"),
  loadingSteps: document.getElementById("loadingSteps"),
  toastContainer: document.getElementById("toastContainer"),
  suggestionChips: document.querySelectorAll(".suggestion-chip"),
};

// ===== Initialization =====
document.addEventListener("DOMContentLoaded", () => {
  loadSettings();
  checkForAuthCallback();
  setupEventListeners();
  updateAuthUI();
  updateGenerateButton();
});

function loadSettings() {
  elements.spotifyClientId.value =
    localStorage.getItem("spotify_client_id") || "";
  elements.openrouterKey.value = localStorage.getItem("openrouter_key") || "";
  elements.aiModel.value = localStorage.getItem("ai_model") || "deepseek/deepseek-chat-v3-0324:free";
  elements.webSearchToggle.checked = localStorage.getItem("web_search_enabled") === "true";

  // Load tokens
  state.spotifyToken = localStorage.getItem("spotify_token");
  state.spotifyTokenExpiry = parseInt(
    localStorage.getItem("spotify_token_expiry") || "0"
  );

  // Check if token expired
  if (state.spotifyToken && Date.now() > state.spotifyTokenExpiry) {
    clearSpotifyAuth();
  }

  if (state.spotifyToken) {
    fetchUserProfile();
  }
}

function setupEventListeners() {
  // Settings modal
  elements.settingsBtn.addEventListener("click", () =>
    openModal(elements.settingsModal)
  );
  elements.closeSettings.addEventListener("click", () =>
    closeModal(elements.settingsModal)
  );
  elements.settingsModal.addEventListener("click", (e) => {
    if (e.target === elements.settingsModal) closeModal(elements.settingsModal);
  });
  elements.saveSettings.addEventListener("click", saveSettingsHandler);

  // Auth
  elements.authBtn.addEventListener("click", handleAuth);

  // Mode toggle
  elements.modeBtns.forEach((btn) => {
    btn.addEventListener("click", () => switchMode(btn.dataset.mode));
  });

  // Generate
  elements.promptText.addEventListener("input", updateGenerateButton);
  elements.playlistUrl.addEventListener("input", updateGenerateButton);
  elements.generateBtn.addEventListener("click", handleGenerate);
  elements.promptText.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!elements.generateBtn.disabled) handleGenerate();
    }
  });

  // Suggestions
  elements.suggestionChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      elements.promptText.value = chip.dataset.prompt;
      updateGenerateButton();
    });
  });

  // Search
  let searchDebounce;
  elements.searchInput.addEventListener("input", (e) => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => searchTracks(e.target.value), 300);
  });

  // Save playlist
  elements.savePlaylistBtn.addEventListener("click", savePlaylistToSpotify);

  // New chat button
  elements.newChatBtn.addEventListener("click", startNewChat);

  // Export/Import
  elements.exportProfileBtn.addEventListener("click", exportProfile);
  elements.importProfileBtn.addEventListener("click", () => elements.importFileInput.click());
  elements.importFileInput.addEventListener("change", importProfile);
}

// ===== Settings =====
function saveSettingsHandler() {
  localStorage.setItem(
    "spotify_client_id",
    elements.spotifyClientId.value.trim()
  );
  localStorage.setItem("openrouter_key", elements.openrouterKey.value.trim());
  localStorage.setItem("ai_model", elements.aiModel.value);
  localStorage.setItem("web_search_enabled", elements.webSearchToggle.checked);
  closeModal(elements.settingsModal);
  showToast("Settings saved!", "success");
  updateGenerateButton();
}

// ===== New Chat =====
function startNewChat() {
  // Reset chat
  elements.chatContainer.innerHTML = `
    <div class="welcome-message">
      <div class="welcome-icon">✨</div>
      <h3>Welcome to AI Playlist Creator</h3>
      <p>Describe the playlist you want to create, or paste a Spotify playlist URL to remix it.</p>
      <div class="suggestions">
        <button class="suggestion-chip" data-prompt="5 upbeat songs for a morning workout">🏃 Morning workout</button>
        <button class="suggestion-chip" data-prompt="Chill lo-fi beats for studying and focus">📚 Study session</button>
        <button class="suggestion-chip" data-prompt="80s synthwave classics for coding">💻 Coding vibes</button>
        <button class="suggestion-chip" data-prompt="Relaxing acoustic songs for a cozy evening">🌙 Evening chill</button>
      </div>
    </div>
  `;
  
  // Re-attach suggestion chip listeners
  elements.chatContainer.querySelectorAll('.suggestion-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      elements.promptText.value = chip.dataset.prompt;
      updateGenerateButton();
    });
  });
  
  // Clear tracks
  state.playlistTracks = [];
  renderTrackList();
  elements.playlistName.value = "My AI Playlist";
  
  showToast("Started new chat!", "info");
}

// ===== Secure Profile Export/Import =====
async function generateEncryptionKey(password) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"]
  );
  return await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode("spotify-playlist-creator-salt"),
      iterations: 100000,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptData(data, password) {
  const key = await generateEncryptionKey(password);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(JSON.stringify(data))
  );
  return {
    iv: Array.from(iv),
    data: Array.from(new Uint8Array(encrypted))
  };
}

async function decryptData(encryptedObj, password) {
  const key = await generateEncryptionKey(password);
  const iv = new Uint8Array(encryptedObj.iv);
  const data = new Uint8Array(encryptedObj.data);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    data
  );
  return JSON.parse(new TextDecoder().decode(decrypted));
}

async function exportProfile() {
  const password = prompt("Enter a password to encrypt your profile (you'll need this to import):");
  if (!password || password.length < 4) {
    showToast("Password must be at least 4 characters", "error");
    return;
  }
  
  const profileData = {
    spotify_client_id: localStorage.getItem("spotify_client_id") || "",
    openrouter_key: localStorage.getItem("openrouter_key") || "",
    ai_model: localStorage.getItem("ai_model") || "deepseek/deepseek-chat-v3-0324:free",
    web_search_enabled: localStorage.getItem("web_search_enabled") === "true",
    exported_at: new Date().toISOString()
  };
  
  try {
    const encrypted = await encryptData(profileData, password);
    const blob = new Blob([JSON.stringify(encrypted, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `spotify-playlist-creator-profile-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Profile exported securely!", "success");
  } catch (error) {
    showToast("Failed to export profile", "error");
    console.error(error);
  }
}

async function importProfile(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const password = prompt("Enter the password used when exporting:");
  if (!password) {
    event.target.value = "";
    return;
  }
  
  try {
    const text = await file.text();
    const encrypted = JSON.parse(text);
    const profileData = await decryptData(encrypted, password);
    
    // Apply settings
    localStorage.setItem("spotify_client_id", profileData.spotify_client_id || "");
    localStorage.setItem("openrouter_key", profileData.openrouter_key || "");
    localStorage.setItem("ai_model", profileData.ai_model || "deepseek/deepseek-chat-v3-0324:free");
    localStorage.setItem("web_search_enabled", profileData.web_search_enabled || false);
    
    // Update UI
    loadSettings();
    showToast("Profile imported successfully!", "success");
  } catch (error) {
    showToast("Failed to decrypt - wrong password or corrupted file", "error");
    console.error(error);
  }
  
  event.target.value = "";
}

// ===== Modal Helpers =====
function openModal(modal) {
  modal.classList.add("active");
}

function closeModal(modal) {
  modal.classList.remove("active");
}

// ===== Spotify OAuth with PKCE =====
function generateRandomString(length) {
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const values = crypto.getRandomValues(new Uint8Array(length));
  return values.reduce((acc, x) => acc + possible[x % possible.length], "");
}

async function sha256(plain) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return await crypto.subtle.digest("SHA-256", data);
}

function base64urlencode(arrayBuffer) {
  let str = "";
  const bytes = new Uint8Array(arrayBuffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    str += String.fromCharCode(bytes[i]);
  }
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function generateCodeChallenge(codeVerifier) {
  const hashed = await sha256(codeVerifier);
  return base64urlencode(hashed);
}

async function handleAuth() {
  if (state.spotifyToken) {
    // Logout
    clearSpotifyAuth();
    updateAuthUI();
    showToast("Disconnected from Spotify", "info");
    return;
  }

  const clientId = localStorage.getItem("spotify_client_id");
  if (!clientId) {
    openModal(elements.settingsModal);
    showToast("Please enter your Spotify Client ID first", "error");
    return;
  }

  // Generate PKCE values
  const codeVerifier = generateRandomString(64);
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const stateParam = generateRandomString(16);

  // Store for callback
  localStorage.setItem("code_verifier", codeVerifier);
  localStorage.setItem("auth_state", stateParam);

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    state: stateParam,
    code_challenge_method: "S256",
    code_challenge: codeChallenge,
  });

  window.location.href = `${SPOTIFY_AUTH_URL}?${params}`;
}

async function checkForAuthCallback() {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get("code");
  const returnedState = urlParams.get("state");
  const error = urlParams.get("error");

  if (error) {
    showToast(`Spotify auth error: ${error}`, "error");
    window.history.replaceState({}, document.title, REDIRECT_URI);
    return;
  }

  if (!code) return;

  const storedState = localStorage.getItem("auth_state");
  if (returnedState !== storedState) {
    showToast("State mismatch. Please try again.", "error");
    window.history.replaceState({}, document.title, REDIRECT_URI);
    return;
  }

  // Clear URL
  window.history.replaceState({}, document.title, REDIRECT_URI);

  // Exchange code for token
  const codeVerifier = localStorage.getItem("code_verifier");
  const clientId = localStorage.getItem("spotify_client_id");

  showLoading("Connecting to Spotify...");

  try {
    const response = await fetch(SPOTIFY_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        grant_type: "authorization_code",
        code: code,
        redirect_uri: REDIRECT_URI,
        code_verifier: codeVerifier,
      }),
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error_description || data.error);
    }

    // Store token
    state.spotifyToken = data.access_token;
    state.spotifyTokenExpiry = Date.now() + data.expires_in * 1000;

    localStorage.setItem("spotify_token", data.access_token);
    localStorage.setItem(
      "spotify_token_expiry",
      state.spotifyTokenExpiry.toString()
    );
    if (data.refresh_token) {
      localStorage.setItem("spotify_refresh_token", data.refresh_token);
    }

    await fetchUserProfile();
    hideLoading();
    showToast("Connected to Spotify!", "success");
  } catch (error) {
    hideLoading();
    showToast(`Auth failed: ${error.message}`, "error");
    console.error("Auth error:", error);
  }

  // Cleanup
  localStorage.removeItem("code_verifier");
  localStorage.removeItem("auth_state");
}

async function fetchUserProfile() {
  try {
    const response = await fetch(`${SPOTIFY_API_URL}/me`, {
      headers: { Authorization: `Bearer ${state.spotifyToken}` },
    });

    if (!response.ok) throw new Error("Failed to fetch profile");

    state.spotifyUser = await response.json();
    updateAuthUI();
  } catch (error) {
    console.error("Profile fetch error:", error);
    clearSpotifyAuth();
  }
}

function clearSpotifyAuth() {
  state.spotifyToken = null;
  state.spotifyTokenExpiry = null;
  state.spotifyUser = null;
  localStorage.removeItem("spotify_token");
  localStorage.removeItem("spotify_token_expiry");
  localStorage.removeItem("spotify_refresh_token");
}

function updateAuthUI() {
  if (state.spotifyUser) {
    elements.authText.textContent =
      state.spotifyUser.display_name || "Connected";
    elements.authBtn.classList.add("btn-secondary");
    elements.authBtn.classList.remove("btn-primary");
  } else {
    elements.authText.textContent = "Connect Spotify";
    elements.authBtn.classList.add("btn-primary");
    elements.authBtn.classList.remove("btn-secondary");
  }
  updateSaveButton();
}

// ===== Mode Toggle =====
function switchMode(mode) {
  state.currentMode = mode;
  elements.modeBtns.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.mode === mode);
  });

  if (mode === "remix") {
    elements.remixInput.style.display = "block";
    elements.promptText.placeholder =
      'How should we remix this playlist? (e.g., "make it more upbeat", "add similar artists")';
  } else {
    elements.remixInput.style.display = "none";
    elements.promptText.placeholder = "Describe your perfect playlist...";
  }

  updateGenerateButton();
}

function updateGenerateButton() {
  const hasKey = !!localStorage.getItem("openrouter_key");
  const hasPrompt = elements.promptText.value.trim().length > 0;
  const hasPlaylistUrl =
    state.currentMode === "remix"
      ? elements.playlistUrl.value.trim().length > 0
      : true;

  elements.generateBtn.disabled = !(hasKey && hasPrompt && hasPlaylistUrl);
}

// ===== AI Generation =====
async function handleGenerate() {
  const prompt = elements.promptText.value.trim();
  const openrouterKey = localStorage.getItem("openrouter_key");
  const webSearchEnabled = localStorage.getItem("web_search_enabled") === "true";
  const model = localStorage.getItem("ai_model") || "deepseek/deepseek-chat-v3-0324:free";

  if (!openrouterKey) {
    openModal(elements.settingsModal);
    showToast("Please enter your OpenRouter API key", "error");
    return;
  }

  // Add user message to chat
  addChatMessage(prompt, "user");
  elements.promptText.value = "";
  updateGenerateButton();

  let systemPrompt = `You are a music expert AI assistant that helps create Spotify playlists. 
When given a description, you suggest specific songs that match the mood, genre, or theme.

IMPORTANT: Always respond with a JSON object containing an array of track suggestions.
Format your response EXACTLY like this, with no additional text before or after:
{
    "playlistName": "A creative name for this playlist",
    "description": "A brief description of the playlist",
    "tracks": [
        {"title": "Song Name", "artist": "Artist Name"},
        {"title": "Another Song", "artist": "Another Artist"}
    ]
}

Suggest 8-12 tracks that are REAL songs available on Spotify. Be specific with song titles and artist names.
Vary your suggestions - include both popular and lesser-known tracks that fit the description.`;

  let userPrompt = prompt;

  // If remix mode, fetch the playlist first
  if (state.currentMode === "remix") {
    const playlistUrl = elements.playlistUrl.value.trim();
    const playlistId = extractPlaylistId(playlistUrl);

    if (!playlistId) {
      showToast("Invalid playlist URL", "error");
      return;
    }

    if (!state.spotifyToken) {
      showToast("Please connect to Spotify first to remix playlists", "error");
      return;
    }

    showLoading("Fetching playlist...");

    try {
      const playlist = await fetchPlaylist(playlistId);
      const trackList = playlist.tracks.items
        .slice(0, 20)
        .map((item) => `"${item.track.name}" by ${item.track.artists[0].name}`)
        .join("\n");

      systemPrompt = `You are a music expert AI that remixes playlists.
Given an existing playlist and a modification request, suggest new tracks that fit the request while maintaining the vibe.

IMPORTANT: Respond ONLY with this JSON format:
{
    "playlistName": "A creative remixed name",
    "description": "Description of the remixed playlist",
    "tracks": [
        {"title": "Song Name", "artist": "Artist Name"}
    ]
}

Suggest 8-12 tracks. Include some from the original if they fit, but mostly new suggestions.`;

      userPrompt = `Original playlist "${playlist.name}":\n${trackList}\n\nModification request: ${prompt}`;
    } catch (error) {
      hideLoading();
      showToast(`Failed to fetch playlist: ${error.message}`, "error");
      return;
    }
  }

  showLoading("AI is creating your playlist...", true);
  setLoadingStep(1);

  // Add :online suffix for web search if enabled
  let modelToUse = model;
  if (webSearchEnabled && !model.includes(":online") && !model.includes(":free")) {
    modelToUse = model + ":online";
  }

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openrouterKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": window.location.origin,
        "X-Title": "AI Playlist Creator",
      },
      body: JSON.stringify({
        model: modelToUse,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.8,
      }),
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message || "API error");
    }

    const aiResponse = data.choices[0].message.content;

    // Parse the response
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Invalid response format from AI");
    }

    const playlist = JSON.parse(jsonMatch[0]);

    // Update playlist name
    if (playlist.playlistName) {
      elements.playlistName.value = playlist.playlistName;
    }

    // Add AI response to chat
    addChatMessage(
      `🎵 Created "${playlist.playlistName || "New Playlist"}" with ${
        playlist.tracks.length
      } suggested tracks. Finding them on Spotify...`,
      "ai"
    );

    setLoadingStep(2);

    // Search for tracks on Spotify
    setLoadingStep(3);
    await searchAndAddTracks(playlist.tracks);

    hideLoading();
  } catch (error) {
    hideLoading();
    console.error("AI generation error:", error);
    addChatMessage(`Sorry, I encountered an error: ${error.message}`, "ai");
    showToast(`Generation failed: ${error.message}`, "error");
  }
}

function extractPlaylistId(url) {
  const match = url.match(/playlist[\/:]([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}

async function fetchPlaylist(playlistId) {
  const response = await fetch(`${SPOTIFY_API_URL}/playlists/${playlistId}`, {
    headers: { Authorization: `Bearer ${state.spotifyToken}` },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch playlist");
  }

  return await response.json();
}

async function searchAndAddTracks(tracks) {
  if (!state.spotifyToken) {
    // Just add the suggestions without Spotify search
    for (const track of tracks) {
      addTrackToPlaylist({
        id: `temp-${Date.now()}-${Math.random()}`,
        name: track.title,
        artists: [{ name: track.artist }],
        album: { images: [] },
        duration_ms: 0,
        preview_url: null,
        external_urls: { spotify: null },
      });
    }
    addChatMessage(
      "⚠️ Connect to Spotify to find actual tracks and save your playlist!",
      "ai"
    );
    return;
  }

  let foundCount = 0;

  for (const track of tracks) {
    try {
      const query = `track:${track.title} artist:${track.artist}`;
      const response = await fetch(
        `${SPOTIFY_API_URL}/search?q=${encodeURIComponent(
          query
        )}&type=track&limit=1`,
        { headers: { Authorization: `Bearer ${state.spotifyToken}` } }
      );

      const data = await response.json();

      if (data.tracks?.items?.length > 0) {
        addTrackToPlaylist(data.tracks.items[0]);
        foundCount++;
      }
    } catch (error) {
      console.warn(`Failed to find: ${track.title} by ${track.artist}`);
    }
  }

  addChatMessage(
    `✅ Found ${foundCount} of ${tracks.length} tracks on Spotify.`,
    "ai"
  );
}

// ===== Chat =====
function addChatMessage(text, type) {
  // Remove welcome message if it exists
  const welcome = elements.chatContainer.querySelector(".welcome-message");
  if (welcome) welcome.remove();

  const message = document.createElement("div");
  message.className = `chat-message ${type}`;
  message.innerHTML = `<div class="bubble">${escapeHtml(text)}</div>`;
  elements.chatContainer.appendChild(message);
  elements.chatContainer.scrollTop = elements.chatContainer.scrollHeight;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// ===== Playlist Management =====
function addTrackToPlaylist(track) {
  // Check for duplicates
  if (state.playlistTracks.some((t) => t.id === track.id)) {
    return;
  }

  state.playlistTracks.push(track);
  renderTrackList();
  updateSaveButton();
}

function removeTrackFromPlaylist(trackId) {
  state.playlistTracks = state.playlistTracks.filter((t) => t.id !== trackId);
  renderTrackList();
  updateSaveButton();
}

function renderTrackList() {
  if (state.playlistTracks.length === 0) {
    elements.trackList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🎵</div>
                <p>No tracks yet</p>
                <span>Generate tracks using AI or search below</span>
            </div>
        `;
  } else {
    elements.trackList.innerHTML = state.playlistTracks
      .map((track) => createTrackHTML(track, true))
      .join("");

    // Add event listeners
    elements.trackList.querySelectorAll(".track-item").forEach((item) => {
      const trackId = item.dataset.trackId;
      const track = state.playlistTracks.find((t) => t.id === trackId);

      item
        .querySelector(".track-cover-wrapper")
        ?.addEventListener("click", () => {
          toggleTrackPreview(track);
        });

      item.querySelector(".remove")?.addEventListener("click", (e) => {
        e.stopPropagation();
        removeTrackFromPlaylist(trackId);
      });
    });
  }

  elements.trackCount.textContent = `${state.playlistTracks.length} tracks`;
}

function createTrackHTML(track, isInPlaylist = false) {
  const albumArt = track.album?.images?.[0]?.url || "";
  const duration = formatDuration(track.duration_ms);
  const artists = track.artists?.map((a) => a.name).join(", ") || "Unknown";

  return `
        <div class="track-item ${
          state.currentPlayingTrack === track.id ? "playing" : ""
        }" data-track-id="${track.id}">
            <div class="track-cover-wrapper">
                ${
                  albumArt
                    ? `<img src="${albumArt}" alt="" class="track-cover">`
                    : '<div class="track-cover"></div>'
                }
                ${
                  track.preview_url
                    ? `
                    <div class="track-play-btn">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="white">
                            ${
                              state.currentPlayingTrack === track.id
                                ? '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>'
                                : '<polygon points="5 3 19 12 5 21 5 3"/>'
                            }
                        </svg>
                    </div>
                `
                    : ""
                }
            </div>
            <div class="track-info">
                <div class="track-name">${escapeHtml(track.name)}</div>
                <div class="track-artist">${escapeHtml(artists)}</div>
            </div>
            ${duration ? `<div class="track-duration">${duration}</div>` : ""}
            <div class="track-actions">
                ${
                  isInPlaylist
                    ? `
                    <button class="track-action-btn remove" title="Remove">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                `
                    : `
                    <button class="track-action-btn add" title="Add to playlist">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                    </button>
                `
                }
            </div>
        </div>
    `;
}

function formatDuration(ms) {
  if (!ms) return "";
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function toggleTrackPreview(track) {
  if (!track.preview_url) {
    showToast("No preview available for this track", "info");
    return;
  }

  if (state.currentAudio && state.currentPlayingTrack === track.id) {
    // Stop current
    state.currentAudio.pause();
    state.currentAudio = null;
    state.currentPlayingTrack = null;
  } else {
    // Stop previous if playing
    if (state.currentAudio) {
      state.currentAudio.pause();
    }

    // Play new
    state.currentAudio = new Audio(track.preview_url);
    state.currentPlayingTrack = track.id;
    state.currentAudio.play();

    state.currentAudio.addEventListener("ended", () => {
      state.currentPlayingTrack = null;
      renderTrackList();
      renderSearchResults();
    });
  }

  renderTrackList();
  renderSearchResults();
}

function updateSaveButton() {
  elements.savePlaylistBtn.disabled =
    !state.spotifyToken || state.playlistTracks.length === 0;
}

// ===== Search =====
let lastSearchResults = [];

async function searchTracks(query) {
  if (!query.trim()) {
    elements.searchResults.innerHTML = "";
    lastSearchResults = [];
    return;
  }

  if (!state.spotifyToken) {
    elements.searchResults.innerHTML =
      '<div class="track-item"><div class="track-info"><div class="track-name">Connect to Spotify to search</div></div></div>';
    return;
  }

  try {
    const response = await fetch(
      `${SPOTIFY_API_URL}/search?q=${encodeURIComponent(
        query
      )}&type=track&limit=5`,
      { headers: { Authorization: `Bearer ${state.spotifyToken}` } }
    );

    const data = await response.json();
    lastSearchResults = data.tracks?.items || [];
    renderSearchResults();
  } catch (error) {
    console.error("Search error:", error);
  }
}

function renderSearchResults() {
  if (lastSearchResults.length === 0) {
    elements.searchResults.innerHTML = "";
    return;
  }

  elements.searchResults.innerHTML = lastSearchResults
    .map((track) => createTrackHTML(track, false))
    .join("");

  // Add event listeners
  elements.searchResults.querySelectorAll(".track-item").forEach((item) => {
    const trackId = item.dataset.trackId;
    const track = lastSearchResults.find((t) => t.id === trackId);

    item
      .querySelector(".track-cover-wrapper")
      ?.addEventListener("click", () => {
        toggleTrackPreview(track);
      });

    item.querySelector(".add")?.addEventListener("click", (e) => {
      e.stopPropagation();
      addTrackToPlaylist(track);
      showToast("Track added!", "success");
    });
  });
}

// ===== Save Playlist =====
async function savePlaylistToSpotify() {
  if (
    !state.spotifyToken ||
    !state.spotifyUser ||
    state.playlistTracks.length === 0
  ) {
    return;
  }

  const playlistName = elements.playlistName.value.trim() || "My AI Playlist";

  showLoading("Creating playlist on Spotify...");

  try {
    // Create playlist
    const createResponse = await fetch(
      `${SPOTIFY_API_URL}/users/${state.spotifyUser.id}/playlists`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${state.spotifyToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: playlistName,
          description: "Created with AI Playlist Creator",
          public: false,
        }),
      }
    );

    if (!createResponse.ok) {
      throw new Error("Failed to create playlist");
    }

    const playlist = await createResponse.json();

    // Add tracks
    const trackUris = state.playlistTracks
      .filter((t) => t.id && !t.id.startsWith("temp-"))
      .map((t) => `spotify:track:${t.id}`);

    if (trackUris.length > 0) {
      const addResponse = await fetch(
        `${SPOTIFY_API_URL}/playlists/${playlist.id}/tracks`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${state.spotifyToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ uris: trackUris }),
        }
      );

      if (!addResponse.ok) {
        throw new Error("Failed to add tracks");
      }
    }

    hideLoading();
    showToast(`Playlist "${playlistName}" saved to Spotify!`, "success");

    // Reset
    state.playlistTracks = [];
    renderTrackList();
    elements.playlistName.value = "My AI Playlist";
  } catch (error) {
    hideLoading();
    console.error("Save error:", error);
    showToast(`Failed to save: ${error.message}`, "error");
  }
}

// ===== Loading & Toast =====
function showLoading(text = "Loading...", showSteps = false) {
  elements.loadingText.textContent = text;
  elements.loadingOverlay.classList.add("active");
  
  // Reset and show/hide steps
  if (elements.loadingSteps) {
    elements.loadingSteps.style.display = showSteps ? "flex" : "none";
    elements.loadingSteps.querySelectorAll(".loading-step").forEach(step => {
      step.classList.remove("active", "done");
    });
  }
}

function setLoadingStep(stepNumber) {
  if (!elements.loadingSteps) return;
  
  elements.loadingSteps.querySelectorAll(".loading-step").forEach(step => {
    const stepNum = parseInt(step.dataset.step);
    if (stepNum < stepNumber) {
      step.classList.remove("active");
      step.classList.add("done");
    } else if (stepNum === stepNumber) {
      step.classList.add("active");
      step.classList.remove("done");
    } else {
      step.classList.remove("active", "done");
    }
  });
}

function hideLoading() {
  elements.loadingOverlay.classList.remove("active");
}

function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `
        <span class="toast-message">${escapeHtml(message)}</span>
        <button class="toast-close">&times;</button>
    `;

  elements.toastContainer.appendChild(toast);

  toast.querySelector(".toast-close").addEventListener("click", () => {
    toast.remove();
  });

  setTimeout(() => toast.remove(), 4000);
}
