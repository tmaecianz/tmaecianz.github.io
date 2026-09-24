// Nordic Minimal Flat Dashboard & Chat Controller
// Static execution for GitHub Pages & local IP testing

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyAAubLj9lK8steZjMMOq62XybYRqi1VsUs",
  authDomain: "emergency-comms-6090c.firebaseapp.com",
  projectId: "emergency-comms-6090c",
  storageBucket: "emergency-comms-6090c.firebasestorage.app",
  messagingSenderId: "987649221907",
  appId: "1:987649221907:web:85b7c23ee02532caa3a6e6",
  measurementId: "G-BEQVWX5NB5"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();
const auth = firebase.auth();

// DOM Elements - Navigation & Views
const dashboardView = document.getElementById("dashboardView");
const chatView = document.getElementById("chatView");
const enterChatBtn = document.getElementById("enterChatBtn");
const backToDashboardBtn = document.getElementById("backToDashboardBtn");

// DOM Elements - Dashboard
const dispatchForm = document.getElementById("dispatchForm");
const customMessageInput = document.getElementById("customMessageInput");
const contactsList = document.getElementById("contactsList");

// DOM Elements - Chat
const userNameLabel = document.getElementById("userNameLabel");
const userProfileBtn = document.getElementById("userProfileBtn");
const clearChatBtn = document.getElementById("clearChatBtn");
const inviteContactBtn = document.getElementById("inviteContactBtn");
const chatMessages = document.getElementById("chatMessages");
const chatEmptyState = document.getElementById("chatEmptyState");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const chatSendBtn = document.getElementById("chatSendBtn");

// DOM Elements - Modals & Toasts
const nameModal = document.getElementById("nameModal");
const nameForm = document.getElementById("nameForm");
const displayNameInput = document.getElementById("displayNameInput");
const randomGuestBtn = document.getElementById("randomGuestBtn");
const inviteModal = document.getElementById("inviteModal");
const closeInviteModalBtn = document.getElementById("closeInviteModalBtn");
const inviteContactsList = document.getElementById("inviteContactsList");
const toastContainer = document.getElementById("toastContainer");

// Application State
let visitorId = localStorage.getItem("chat_visitor_id");
if (!visitorId) {
  visitorId = "usr_" + Math.random().toString(36).substring(2, 9);
  localStorage.setItem("chat_visitor_id", visitorId);
}
let displayName = localStorage.getItem("chat_display_name") || "";
let chatUnsubscribe = null;

// Load cached contacts from localStorage to prevent flash of old content
let dashboardContacts = [];
try {
  const cached = localStorage.getItem("comms_cached_contacts");
  if (cached) {
    dashboardContacts = JSON.parse(cached);
  }
} catch (e) {}

// Real-Time Dynamic Contacts Listener from Firestore
function listenToDynamicContacts() {
  db.collection("incidents").doc("common_room").onSnapshot((doc) => {
    if (doc.exists) {
      const data = doc.data();
      if (data && Array.isArray(data.contacts)) {
        dashboardContacts = data.contacts;
        try {
          localStorage.setItem("comms_cached_contacts", JSON.stringify(data.contacts));
        } catch (e) {}
        renderContacts();
        renderInviteContacts();
      }
    }
  }, (err) => {
    console.warn("Firestore contacts listener note:", err.message);
  });
}

function renderContacts() {
  contactsList.innerHTML = "";
  if (!dashboardContacts || dashboardContacts.length === 0) {
    contactsList.innerHTML = `<span style="color: var(--nord3); font-size: 0.9rem;">Loading contacts...</span>`;
    return;
  }
  dashboardContacts.forEach(contact => {
    const row = document.createElement("div");
    row.className = "contact-row";

    row.innerHTML = `
      <span class="contact-name-txt">${contact.name}:</span>
      <a href="tel:${contact.phone}" class="contact-phone-txt" title="Tap to call ${contact.name}">${contact.phone}</a>
    `;

    const link = row.querySelector(".contact-phone-txt");
    link.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      navigator.clipboard.writeText(contact.phone).then(() => {
        showToast(`Copied ${contact.phone}`);
      });
    });

    contactsList.appendChild(row);
  });
}

// Render Invite Modal Contacts
function renderInviteContacts() {
  inviteContactsList.innerHTML = "";
  if (!dashboardContacts || dashboardContacts.length === 0) {
    inviteContactsList.innerHTML = `<span style="color: var(--nord3); font-size: 0.85rem; padding: 8px 0;">Loading contacts...</span>`;
    return;
  }
  dashboardContacts.forEach(contact => {
    const row = document.createElement("div");
    row.className = "invite-contact-row";

    row.innerHTML = `
      <span class="invite-contact-name">${contact.name} (${contact.phone})</span>
      <button type="button" class="nord-btn-sm-invite" data-name="${contact.name}">Invite</button>
    `;

    const btn = row.querySelector(".nord-btn-sm-invite");
    btn.addEventListener("click", async () => {
      const inviteData = {
        type: "invite",
        contactName: contact.name,
        contactPhone: contact.phone,
        message: `You have been invited by ${displayName || 'someone'} to join the Comms chat room.`,
        senderName: displayName || "Visitor",
        senderId: visitorId,
        status: "pending",
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      };

      // Write invite into common room with status: pending so local listener triggers email
      try {
        await commonRoomRef.add({
          type: "invite",
          contactName: contact.name,
          contactPhone: contact.phone,
          status: "pending",
          senderId: visitorId,
          senderName: displayName || "Visitor",
          text: `[Invite] Invitation sent to ${contact.name}`,
          message: `You have been invited by ${displayName || 'someone'} to join the Comms chat room.`,
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
      } catch (err) {
        // Fallback write
        db.collection("notifications").add(inviteData).catch(() => {});
      }

      showToast(`Invitation sent to ${contact.name}`);
      closeInviteModal();
    });

    inviteContactsList.appendChild(row);
  });
}

// ==========================================================================
// VIEW SWITCHING (DASHBOARD ↔ CHAT)
// ==========================================================================
function switchView(viewName) {
  if (viewName === "chat") {
    dashboardView.classList.remove("active-view");
    chatView.classList.add("active-view");
    window.location.hash = "chat";

    if (!displayName) {
      setTimeout(openNameModal, 200);
    } else {
      setTimeout(() => chatInput.focus(), 200);
    }

    chatMessages.scrollTop = chatMessages.scrollHeight;
  } else {
    chatView.classList.remove("active-view");
    dashboardView.classList.add("active-view");
    window.location.hash = "dashboard";
  }
}

enterChatBtn.addEventListener("click", () => switchView("chat"));
backToDashboardBtn.addEventListener("click", () => switchView("dashboard"));

window.addEventListener("hashchange", () => {
  const hash = window.location.hash.replace("#", "");
  if (hash === "chat") {
    switchView("chat");
  } else {
    switchView("dashboard");
  }
});

// ==========================================================================
// TOAST NOTIFICATIONS (NO EMOJIS)
// ==========================================================================
function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "nord-toast";
  toast.textContent = message;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transition = "opacity 0.2s ease";
    setTimeout(() => toast.remove(), 200);
  }, 3200);
}

// ==========================================================================
// SEND ALERT NOTIFICATION TRIGGER
// ==========================================================================
dispatchForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = customMessageInput.value.trim();

  const alertData = {
    type: "alert",
    target: "indrajith",
    message: text || "Alert notification triggered from Comms dashboard",
    senderName: displayName || "Visitor",
    senderId: visitorId,
    status: "pending",
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  };

  try {
    await db.collection("notifications").add(alertData);
  } catch (err) {
    db.collection("incidents").doc("common_room").collection("notifications").add(alertData).catch(() => {});
  }

  // Log into common room with status: pending so local listener triggers email
  try {
    await commonRoomRef.add({
      type: "alert",
      target: "indrajith",
      status: "pending",
      senderId: visitorId,
      senderName: displayName || "Visitor",
      message: text || "Alert notification triggered from Comms dashboard",
      text: text ? `[Alert] ${text}` : "[Alert] Notification triggered from Comms",
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (err) {
    // Continue even if firestore write fails
  }

  showToast(text ? `Alert sent: "${text}"` : "Alert notification triggered");
  customMessageInput.value = "";
});

// ==========================================================================
// DISPLAY NAME MODAL
// ==========================================================================
const randomNames = ["Alex", "Sam", "Kai", "Robin", "River", "Morgan", "Jordan", "Taylor", "Casey", "Quinn"];

function generateRandomName() {
  const name = randomNames[Math.floor(Math.random() * randomNames.length)];
  const num = Math.floor(100 + Math.random() * 900);
  return `${name}_${num}`;
}

function updateUserProfileUI() {
  userNameLabel.textContent = displayName ? displayName : "Set Name";
}

function openNameModal() {
  displayNameInput.value = displayName || "";
  nameModal.classList.add("active");
  setTimeout(() => displayNameInput.focus(), 80);
}

function closeNameModal() {
  nameModal.classList.remove("active");
}

userProfileBtn.addEventListener("click", openNameModal);

randomGuestBtn.addEventListener("click", () => {
  displayNameInput.value = generateRandomName();
});

nameForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const trimmed = displayNameInput.value.trim();
  if (!trimmed) return;
  displayName = trimmed;
  localStorage.setItem("chat_display_name", displayName);
  updateUserProfileUI();
  closeNameModal();
  showToast(`Name set to ${displayName}`);
  chatInput.focus();
});

// ==========================================================================
// INVITE CONTACT MODAL
// ==========================================================================
function openInviteModal() {
  inviteModal.classList.add("active");
}

function closeInviteModal() {
  inviteModal.classList.remove("active");
}

inviteContactBtn.addEventListener("click", openInviteModal);
closeInviteModalBtn.addEventListener("click", closeInviteModal);

inviteModal.addEventListener("click", (e) => {
  if (e.target === inviteModal) {
    closeInviteModal();
  }
});

nameModal.addEventListener("click", (e) => {
  if (e.target === nameModal) {
    closeNameModal();
  }
});

// ==========================================================================
// REAL-TIME FIRESTORE CHAT
// ==========================================================================
const commonRoomRef = db.collection("incidents").doc("common_room").collection("messages");

function listenToChat() {
  if (chatUnsubscribe) {
    chatUnsubscribe();
  }

  db.collection("incidents").doc("common_room").set({
    type: "common_chat_room",
    status: "active",
    lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true }).catch(() => {});

  chatUnsubscribe = commonRoomRef
    .orderBy("timestamp", "asc")
    .limitToLast(80)
    .onSnapshot((snapshot) => {
      chatMessages.innerHTML = "";

      if (snapshot.empty) {
        chatEmptyState.style.display = "block";
        chatMessages.appendChild(chatEmptyState);
        return;
      }

      chatEmptyState.style.display = "none";

      snapshot.forEach(doc => {
        const msg = doc.data();
        appendMessageElement(msg);
      });

      chatMessages.scrollTop = chatMessages.scrollHeight;
    }, (err) => {
      console.warn("Chat listener note:", err.message);
    });
}

function appendMessageElement(msg) {
  const isMe = msg.senderId === visitorId;
  const item = document.createElement("div");
  item.className = `msg-item ${isMe ? "self" : "other"}`;

  const senderName = msg.senderName || (isMe ? "You" : "Participant");

  let formattedTime = "";
  if (msg.timestamp && msg.timestamp.toDate) {
    formattedTime = msg.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  item.innerHTML = `
    ${!isMe ? `<span class="msg-author">${escapeHtml(senderName)}</span>` : ''}
    <div class="msg-bubble-box">${escapeHtml(msg.text)}</div>
    ${formattedTime ? `<span class="msg-stamp">${formattedTime}</span>` : ''}
  `;

  chatMessages.appendChild(item);
}

chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;

  if (!displayName) {
    openNameModal();
    return;
  }

  chatInput.value = "";
  chatSendBtn.disabled = true;

  const newMsg = {
    senderId: visitorId,
    senderName: displayName,
    text: text,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  };

  try {
    await commonRoomRef.add(newMsg);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  } catch (err) {
    showToast("Message failed to send");
  } finally {
    chatSendBtn.disabled = false;
    chatInput.focus();
  }
});

// Clear All Chat Messages
clearChatBtn.addEventListener("click", async () => {
  if (!confirm("Are you sure you want to clear all chat messages in this room?")) {
    return;
  }

  clearChatBtn.disabled = true;
  clearChatBtn.textContent = "...";

  try {
    const snapshot = await commonRoomRef.get();
    if (snapshot.empty) {
      showToast("Chat is already empty");
      return;
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();

    chatMessages.innerHTML = "";
    chatEmptyState.style.display = "block";
    chatMessages.appendChild(chatEmptyState);
    showToast("Chat history cleared");
  } catch (err) {
    console.error("Failed to clear chat:", err);
    showToast("Failed to clear chat");
  } finally {
    clearChatBtn.disabled = false;
    clearChatBtn.textContent = "Clear";
  }
});

// HTML Escaper
function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Bootstrap
function initApp() {
  updateUserProfileUI();
  renderContacts();
  renderInviteContacts();
  listenToDynamicContacts();

  if (window.location.hash === "#chat") {
    switchView("chat");
  } else {
    switchView("dashboard");
  }

  auth.signInAnonymously().catch(() => {});
  listenToChat();
}

initApp();
