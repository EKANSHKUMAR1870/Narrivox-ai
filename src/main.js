const loginView = document.querySelector("#login-view");
const workspaceView = document.querySelector("#workspace-view");
const loginForm = document.querySelector("#login-form");
const signupForm = document.querySelector("#signup-form");
const scriptForm = document.querySelector("#script-form");
const output = document.querySelector("#output");
const statusValue = document.querySelector("#status");
const submitButton = document.querySelector("#generate-button");
const historyList = document.querySelector("#history-list");
const userEmail = document.querySelector("#user-email");
const logoutButton = document.querySelector("#logout-button");
const newScriptButton = document.querySelector("#new-script-button");
const toneSelect = document.querySelector("#tone");
const activeTone = document.querySelector("#active-tone");
const authStatus = document.querySelector("#auth-status");
const showLoginButton = document.querySelector("#show-login-button");
const showSignupButton = document.querySelector("#show-signup-button");
const historyCount = document.querySelector("#history-count");
const latestTone = document.querySelector("#latest-tone");
const historySearch = document.querySelector("#history-search");
const generateThumbnailButton = document.querySelector("#generate-thumbnail-button");
const thumbnailImage = document.querySelector("#thumbnail-image");
const thumbnailEmpty = document.querySelector("#thumbnail-empty");

let currentHistoryId = null;
let currentUser = null;
let sessionToken = localStorage.getItem("narrivox-session-token") || "";
let scriptHistory = [];

function updateOutput(message, status) {
  output.textContent = message;
  statusValue.textContent = status;
}

function setLoadingState(isLoading) {
  submitButton.disabled = isLoading;
  submitButton.textContent = isLoading ? "Generating..." : "Generate Script";
}

function updateToneBadge() {
  activeTone.textContent = `Tone: ${toneSelect.value}`;
}

function setAuthStatus(message) {
  authStatus.textContent = message;
}

function setThumbnailState(thumbnail, emptyMessage = "Generate a thumbnail for the active script.") {
  if (thumbnail?.base64) {
    thumbnailImage.src = `data:${thumbnail.mimeType || "image/png"};base64,${thumbnail.base64}`;
    thumbnailImage.classList.remove("hidden");
    thumbnailEmpty.classList.add("hidden");
    return;
  }

  thumbnailImage.removeAttribute("src");
  thumbnailImage.classList.add("hidden");
  thumbnailEmpty.textContent = emptyMessage;
  thumbnailEmpty.classList.remove("hidden");
}

function formatTimestamp(value) {
  const date = new Date(value);
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function renderHistory() {
  const query = historySearch.value.trim().toLowerCase();
  const items = query
    ? scriptHistory.filter(
        (item) =>
          item.topic.toLowerCase().includes(query) || item.tone.toLowerCase().includes(query)
      )
    : scriptHistory;

  historyList.replaceChildren();
  historyCount.textContent = String(scriptHistory.length);
  latestTone.textContent = scriptHistory[0]?.tone || "None yet";

  if (items.length === 0) {
    const emptyState = document.createElement("p");
    emptyState.className = "history-empty";
    emptyState.textContent = query
      ? "No history matches that search yet."
      : "No saved scripts yet. Generate one to start your vault.";
    historyList.append(emptyState);
    return;
  }

  items.forEach((item) => {
    const itemCard = document.createElement("div");
    itemCard.className = "history-item";
    if (item.id === currentHistoryId) {
      itemCard.classList.add("active");
    }

    const contentButton = document.createElement("button");
    contentButton.type = "button";
    contentButton.className = "history-item-button";

    const title = document.createElement("strong");
    title.textContent = item.topic;

    const metaTone = document.createElement("span");
    metaTone.className = "history-meta";
    metaTone.textContent = `${item.tone} | ${item.duration}`;

    const metaDate = document.createElement("span");
    metaDate.className = "history-meta";
    metaDate.textContent = formatTimestamp(item.createdAt);

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "history-delete-button";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", (event) => {
      event.stopPropagation();
      deleteHistoryItem(item.id);
    });

    contentButton.append(title, metaTone, metaDate);
    contentButton.addEventListener("click", () => loadHistoryItem(item.id));
    itemCard.append(contentButton, deleteButton);
    historyList.append(itemCard);
  });
}

function fillForm(data) {
  scriptForm.topic.value = data.topic || "";
  scriptForm.audience.value = data.audience || "";
  scriptForm.tone.value = data.tone || scriptForm.tone.value;
  scriptForm.duration.value = data.duration || scriptForm.duration.value;
  scriptForm.objective.value = data.objective || "";
  scriptForm.keyPoints.value = data.keyPoints || "";
  scriptForm.callToAction.value = data.callToAction || "";
  updateToneBadge();
}

function loadHistoryItem(id) {
  const item = scriptHistory.find((entry) => entry.id === id);
  if (!item) {
    return;
  }

  currentHistoryId = id;
  fillForm(item.request);
  updateOutput(item.script, `Loaded from history: ${formatTimestamp(item.createdAt)}`);
  setThumbnailState(item.thumbnail, "No thumbnail yet for this script. Generate one from the panel above.");
  renderHistory();
}

function showWorkspace(user, scripts) {
  currentUser = user;
  scriptHistory = Array.isArray(scripts) ? scripts : [];
  userEmail.textContent = user.email;
  loginView.classList.add("hidden");
  workspaceView.classList.remove("hidden");
  renderHistory();
  updateToneBadge();

  if (scriptHistory.length > 0) {
    loadHistoryItem(scriptHistory[0].id);
  } else {
    updateOutput("Your script will appear here.", "Ready for your next idea.");
    setThumbnailState(null, "Generate a script first, then create a thumbnail for it.");
  }
}

function showLogin() {
  currentUser = null;
  scriptHistory = [];
  workspaceView.classList.add("hidden");
  loginView.classList.remove("hidden");
}

function clearComposer() {
  currentHistoryId = null;
  scriptForm.reset();
  scriptForm.tone.value = "Clear and motivational";
  scriptForm.duration.value = "4 to 6 minutes";
  updateToneBadge();
  updateOutput("Your script will appear here.", "Ready for your next idea.");
  setThumbnailState(null, "Generate a script first, then create a thumbnail for it.");
  renderHistory();
}

async function deleteHistoryItem(id) {
  try {
    await requestJson("/api/delete-script", {
      method: "POST",
      body: JSON.stringify({ scriptId: id })
    });

    scriptHistory = scriptHistory.filter((item) => item.id !== id);

    if (currentHistoryId === id) {
      currentHistoryId = null;

      if (scriptHistory.length > 0) {
        loadHistoryItem(scriptHistory[0].id);
        return;
      }

      clearComposer();
      return;
    }

    renderHistory();
  } catch (error) {
    updateOutput(
      error instanceof Error ? error.message : "Unable to delete this history item.",
      "Delete failed"
    );
  }
}

function setActiveAuthTab(mode) {
  const showLogin = mode === "login";
  loginForm.classList.toggle("hidden", !showLogin);
  signupForm.classList.toggle("hidden", showLogin);
  showLoginButton.classList.toggle("active", showLogin);
  showSignupButton.classList.toggle("active", !showLogin);
  showLoginButton.setAttribute("aria-selected", String(showLogin));
  showSignupButton.setAttribute("aria-selected", String(!showLogin));
}

async function requestJson(url, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
    ...(options.headers || {})
  };

  const response = await fetch(url, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.error || "Request failed.");
  }

  return data;
}

async function handleAuthSubmit(event, mode) {
  event.preventDefault();

  const form = mode === "login" ? loginForm : signupForm;
  const formData = new FormData(form);
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "").trim();

  if (!email || !password) {
    return;
  }

  setAuthStatus(mode === "login" ? "Logging you in..." : "Creating your account...");

  try {
    const data = await requestJson(`/api/auth/${mode}`, {
      method: "POST",
      body: JSON.stringify({ email, password })
    });

    sessionToken = data.token;
    localStorage.setItem("narrivox-session-token", sessionToken);
    loginForm.reset();
    signupForm.reset();
    setAuthStatus("Synced with the database.");
    showWorkspace(data.user, data.scripts || []);
  } catch (error) {
    setAuthStatus(error instanceof Error ? error.message : "Authentication failed.");
  }
}

loginForm.addEventListener("submit", (event) => handleAuthSubmit(event, "login"));
signupForm.addEventListener("submit", (event) => handleAuthSubmit(event, "signup"));
showLoginButton.addEventListener("click", () => setActiveAuthTab("login"));
showSignupButton.addEventListener("click", () => setActiveAuthTab("signup"));

logoutButton.addEventListener("click", async () => {
  try {
    await requestJson("/api/auth/logout", {
      method: "POST"
    });
  } catch {}

  sessionToken = "";
  localStorage.removeItem("narrivox-session-token");
  loginForm.reset();
  signupForm.reset();
  setActiveAuthTab("login");
  setAuthStatus("Create an account or log in to sync scripts with the database.");
  showLogin();
});

newScriptButton.addEventListener("click", clearComposer);
toneSelect.addEventListener("change", updateToneBadge);
historySearch.addEventListener("input", renderHistory);

async function handleSubmit(event) {
  event.preventDefault();

  const formData = new FormData(scriptForm);
  const payload = Object.fromEntries(formData.entries());

  setLoadingState(true);
  updateToneBadge();
  updateOutput("Narrivox AI is building your outline, hook, and full script...", "Generating script...");

  try {
    const data = await requestJson("/api/generate-script", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    updateOutput(data.script, "Script ready");
    scriptHistory = [data.savedScript, ...scriptHistory.filter((item) => item.id !== data.savedScript.id)];
    currentHistoryId = data.savedScript.id;
    setThumbnailState(null, "Script saved. Generate a thumbnail for this script when you're ready.");
    renderHistory();
  } catch (error) {
    updateOutput(
      error instanceof Error ? error.message : "Something went wrong while generating the script.",
      "Request failed"
    );
  } finally {
    setLoadingState(false);
  }
}

scriptForm.addEventListener("submit", handleSubmit);

generateThumbnailButton.addEventListener("click", async () => {
  if (!currentHistoryId) {
    setThumbnailState(null, "Generate and save a script before creating a thumbnail.");
    return;
  }

  generateThumbnailButton.disabled = true;
  generateThumbnailButton.textContent = "Generating...";
  setThumbnailState(null, "Narrivox AI is generating a thumbnail preview...");

  try {
    const data = await requestJson("/api/generate-thumbnail", {
      method: "POST",
      body: JSON.stringify({ scriptId: currentHistoryId })
    });

    scriptHistory = scriptHistory.map((item) =>
      item.id === currentHistoryId ? { ...item, thumbnail: data.thumbnail } : item
    );
    const currentItem = scriptHistory.find((item) => item.id === currentHistoryId);
    setThumbnailState(currentItem?.thumbnail || data.thumbnail);
    renderHistory();
  } catch (error) {
    setThumbnailState(
      null,
      error instanceof Error ? error.message : "Unable to generate thumbnail right now."
    );
  } finally {
    generateThumbnailButton.disabled = false;
    generateThumbnailButton.textContent = "Generate Thumbnail";
  }
});

async function restoreSession() {
  if (!sessionToken) {
    showLogin();
    updateToneBadge();
    setActiveAuthTab("login");
    setThumbnailState(null, "Generate a script first, then create a thumbnail for it.");
    return;
  }

  try {
    const data = await requestJson("/api/auth/session", {
      method: "GET"
    });

    showWorkspace(data.user, data.scripts || []);
  } catch {
    sessionToken = "";
    localStorage.removeItem("narrivox-session-token");
    showLogin();
    setActiveAuthTab("login");
  } finally {
    updateToneBadge();
  }
}

restoreSession();
