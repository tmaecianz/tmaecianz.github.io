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

// Enable IndexedDB Multi-Tab Offline Persistence for faster loads and reduced read costs
if (db && db.enablePersistence) {
  db.enablePersistence({ synchronizeTabs: true }).catch(() => {});
}

// Cryptographic SHA-256 password hashing with room-specific salt
async function hashPassword(password, roomId) {
  const enc = new TextEncoder();
  const data = enc.encode(`${roomId}:${password.trim()}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// DOM Elements - Navigation & Views
const dashboardView = document.getElementById("dashboardView");
const chatView = document.getElementById("chatView");
const enterChatBtn = document.getElementById("enterChatBtn");
const createCustomRoomBtn = document.getElementById("createCustomRoomBtn");
const joinCustomRoomBtn = document.getElementById("joinCustomRoomBtn");
const backToDashboardBtn = document.getElementById("backToDashboardBtn");

// DOM Elements - Dashboard
const dispatchForm = document.getElementById("dispatchForm");
const customMessageInput = document.getElementById("customMessageInput");
const contactsList = document.getElementById("contactsList");

// DOM Elements - Chat
const chatTitleText = document.getElementById("chatTitleText");
const chatRoomBadge = document.getElementById("chatRoomBadge");
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
const inviteExternalForm = document.getElementById("inviteExternalForm");
const inviteEmailInput = document.getElementById("inviteEmailInput");
const sendEmailInviteBtn = document.getElementById("sendEmailInviteBtn");

const createRoomModal = document.getElementById("createRoomModal");
const closeCreateRoomModalBtn = document.getElementById("closeCreateRoomModalBtn");
const cancelCreateRoomBtn = document.getElementById("cancelCreateRoomBtn");
const createRoomForm = document.getElementById("createRoomForm");
const createRoomNameInput = document.getElementById("createRoomNameInput");
const createRoomPasswordInput = document.getElementById("createRoomPasswordInput");
const submitCreateRoomBtn = document.getElementById("submitCreateRoomBtn");

const joinRoomModal = document.getElementById("joinRoomModal");
const closeJoinRoomModalBtn = document.getElementById("closeJoinRoomModalBtn");
const cancelJoinRoomBtn = document.getElementById("cancelJoinRoomBtn");
const joinRoomForm = document.getElementById("joinRoomForm");
const joinRoomNameInput = document.getElementById("joinRoomNameInput");
const joinRoomPasswordInput = document.getElementById("joinRoomPasswordInput");
const submitJoinRoomBtn = document.getElementById("submitJoinRoomBtn");

const toastContainer = document.getElementById("toastContainer");

// Application State
const COMMON_ROOM = {
  id: "common_room",
  name: "Online Chat",
  isCustom: false
};

let currentRoom = COMMON_ROOM;
try {
  const cachedRoom = localStorage.getItem("comms_current_room");
  if (cachedRoom) {
    const parsed = JSON.parse(cachedRoom);
    if (parsed && parsed.id) {
      currentRoom = parsed;
    }
  }
} catch (e) {}

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
      const inviteMsg = currentRoom.isCustom
        ? `You have been invited by ${displayName || 'someone'} to join the private chat room "${currentRoom.name}".`
        : `You have been invited by ${displayName || 'someone'} to join the Comms chat room.`;

      const inviteData = {
        type: "invite",
        contactName: contact.name,
        contactPhone: contact.phone,
        roomId: currentRoom.id,
        roomName: currentRoom.name,
        isCustom: currentRoom.isCustom,
        message: inviteMsg,
        senderName: displayName || "Visitor",
        senderId: visitorId,
        status: "pending",
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      };

      // 1. Enqueue notification in 'notifications' collection so local email listener dispatches email
      try {
        await db.collection("notifications").add(inviteData);
      } catch (err) {
        console.warn("Notifications queue write note:", err);
      }

      // 2. Log invite event into the active chat room feed
      try {
        const messagesRef = getRoomMessagesRef(currentRoom);
        await messagesRef.add({
          type: "invite",
          contactName: contact.name,
          contactPhone: contact.phone,
          senderId: visitorId,
          senderName: displayName || "Visitor",
          text: `[Invite] Invitation sent to ${contact.name}`,
          message: inviteMsg,
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
      } catch (err) {
        console.warn("Chat feed invite log note:", err);
      }

      showToast(`Invitation sent to ${contact.name}`);
      closeInviteModal();
    });

    inviteContactsList.appendChild(row);
  });
}

// ==========================================================================
// VIEW SWITCHING (DASHBOARD ↔ CHAT) & LISTENER LIFECYCLE OPTIMIZATION
// ==========================================================================
function switchView(viewName) {
  if (viewName === "chat") {
    dashboardView.classList.remove("active-view");
    chatView.classList.add("active-view");
    window.location.hash = currentRoom.isCustom ? `chat?room=${currentRoom.id}` : "chat";

    if (!displayName) {
      setTimeout(openNameModal, 200);
    } else {
      setTimeout(() => chatInput.focus(), 200);
    }

    // Attach chat listener only while on chat view
    listenToChat();
  } else {
    chatView.classList.remove("active-view");
    dashboardView.classList.add("active-view");
    window.location.hash = "dashboard";

    // Clean up real-time listener when leaving chat to prevent memory & bandwidth leaks
    if (chatUnsubscribe) {
      chatUnsubscribe();
      chatUnsubscribe = null;
    }
  }
}

enterChatBtn.addEventListener("click", () => {
  currentRoom = COMMON_ROOM;
  try {
    localStorage.setItem("comms_current_room", JSON.stringify(currentRoom));
  } catch (e) {}
  switchView("chat");
});
backToDashboardBtn.addEventListener("click", () => switchView("dashboard"));

window.addEventListener("hashchange", () => {
  const hash = window.location.hash.replace("#", "");
  if (hash.startsWith("chat")) {
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
  if (inviteEmailInput) {
    inviteEmailInput.value = "";
  }
  inviteModal.classList.add("active");
  setTimeout(() => {
    if (inviteEmailInput) inviteEmailInput.focus();
  }, 80);
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

if (inviteExternalForm) {
  inviteExternalForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = (inviteEmailInput.value || "").trim();
    if (!email || !email.includes("@")) {
      showToast("Please enter a valid email address");
      return;
    }

    sendEmailInviteBtn.disabled = true;
    sendEmailInviteBtn.textContent = "...";

    const inviteMsg = currentRoom.isCustom
      ? `You have been invited by ${displayName || 'someone'} to join chat room "${currentRoom.name}".`
      : `You have been invited by ${displayName || 'someone'} to join the Comms chat room.`;

    const inviteData = {
      type: "invite",
      contactName: email,
      recipientEmail: email,
      email: email,
      target: email,
      roomId: currentRoom.id,
      roomName: currentRoom.name,
      isCustom: currentRoom.isCustom,
      message: inviteMsg,
      senderName: displayName || "Visitor",
      senderId: visitorId,
      status: "pending",
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };

    // 1. Enqueue notification in 'notifications' collection so local email listener dispatches email
    try {
      await db.collection("notifications").add(inviteData);
    } catch (err) {
      console.warn("Notifications queue write note:", err);
    }

    // 2. Log invite event into the active chat room feed
    try {
      const messagesRef = getRoomMessagesRef(currentRoom);
      await messagesRef.add({
        type: "invite",
        contactName: email,
        recipientEmail: email,
        senderId: visitorId,
        senderName: displayName || "Visitor",
        text: `[Invite] Invitation sent to ${email}`,
        message: inviteMsg,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (err) {
      console.warn("Chat feed invite log note:", err);
    }

    showToast(`Invitation sent to ${email}`);
    sendEmailInviteBtn.disabled = false;
    sendEmailInviteBtn.textContent = "Invite";
    inviteEmailInput.value = "";
    closeInviteModal();
  });
}

nameModal.addEventListener("click", (e) => {
  if (e.target === nameModal) {
    closeNameModal();
  }
});

// ==========================================================================
// CUSTOM ROOM LOGIC (CREATE & JOIN WITH PASSWORD)
// ==========================================================================
function sanitizeRoomId(name) {
  if (!name) return "";
  return name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_").replace(/^_+|_+$/g, "").substring(0, 32);
}

function updateChatHeaderUI() {
  if (!chatTitleText || !chatRoomBadge) return;
  if (currentRoom.isCustom) {
    chatTitleText.textContent = currentRoom.name;
    chatRoomBadge.textContent = "";
    chatRoomBadge.style.display = "none";
    if (clearChatBtn) {
      clearChatBtn.textContent = "Delete";
      clearChatBtn.title = "Delete this custom chat room";
    }
  } else {
    chatTitleText.textContent = "Online Chat";
    chatRoomBadge.textContent = "Common Room";
    chatRoomBadge.style.display = "";
    chatRoomBadge.classList.remove("custom");
    if (clearChatBtn) {
      clearChatBtn.textContent = "Clear";
      clearChatBtn.title = "Clear all messages";
    }
  }
}


// Create Custom Room Modal Handlers
function openCreateRoomModal() {
  createRoomNameInput.value = "";
  createRoomPasswordInput.value = "";
  createRoomModal.classList.add("active");
  setTimeout(() => createRoomNameInput.focus(), 80);
}

function closeCreateRoomModal() {
  createRoomModal.classList.remove("active");
}

createCustomRoomBtn.addEventListener("click", openCreateRoomModal);
closeCreateRoomModalBtn.addEventListener("click", closeCreateRoomModal);
cancelCreateRoomBtn.addEventListener("click", closeCreateRoomModal);

createRoomModal.addEventListener("click", (e) => {
  if (e.target === createRoomModal) {
    closeCreateRoomModal();
  }
});

createRoomForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const roomName = createRoomNameInput.value.trim();
  const password = createRoomPasswordInput.value.trim();

  if (!roomName) {
    showToast("Please enter a room name");
    return;
  }
  if (!password) {
    showToast("Please set a room password");
    return;
  }
  if (password.length < 3) {
    showToast("Password must be at least 3 characters");
    return;
  }

  const roomId = sanitizeRoomId(roomName);
  if (!roomId || roomId.length < 2) {
    showToast("Room name must have at least 2 alphanumeric characters");
    return;
  }
  if (roomId === "common_room") {
    showToast("This name is reserved for the common chat room");
    return;
  }

  submitCreateRoomBtn.disabled = true;
  submitCreateRoomBtn.textContent = "Creating...";

  try {
    const roomDocRef = db.collection("custom_rooms").doc(roomId);
    const docSnap = await roomDocRef.get();

    if (docSnap.exists) {
      showToast("Room already exists. Choose a different name or join it.");
      submitCreateRoomBtn.disabled = false;
      submitCreateRoomBtn.textContent = "Create";
      return;
    }

    // Cryptographic hash - plain text passwords are never stored
    const passwordHash = await hashPassword(password, roomId);

    await roomDocRef.set({
      roomId: roomId,
      name: roomName,
      passwordHash: passwordHash,
      createdBy: visitorId,
      creatorName: displayName || "Visitor",
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      lastActive: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Mark room as authorized in this browser session
    try {
      sessionStorage.setItem("unlocked_room_" + roomId, "true");
    } catch (e) {}

    currentRoom = {
      id: roomId,
      name: roomName,
      isCustom: true
    };
    try {
      localStorage.setItem("comms_current_room", JSON.stringify(currentRoom));
    } catch (e) {}

    closeCreateRoomModal();
    showToast(`Room "${roomName}" created`);
    switchView("chat");
  } catch (err) {
    console.error("Create room error:", err);
    showToast("Failed to create room. Please try again.");
  } finally {
    submitCreateRoomBtn.disabled = false;
    submitCreateRoomBtn.textContent = "Create";
  }
});

// Join Custom Room Modal Handlers
function openJoinRoomModal() {
  joinRoomNameInput.value = "";
  joinRoomPasswordInput.value = "";
  joinRoomModal.classList.add("active");
  setTimeout(() => joinRoomNameInput.focus(), 80);
}

function closeJoinRoomModal() {
  joinRoomModal.classList.remove("active");
}

joinCustomRoomBtn.addEventListener("click", openJoinRoomModal);
closeJoinRoomModalBtn.addEventListener("click", closeJoinRoomModal);
cancelJoinRoomBtn.addEventListener("click", closeJoinRoomModal);

joinRoomModal.addEventListener("click", (e) => {
  if (e.target === joinRoomModal) {
    closeJoinRoomModal();
  }
});

joinRoomForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const roomName = joinRoomNameInput.value.trim();
  const password = joinRoomPasswordInput.value.trim();

  if (!roomName) {
    showToast("Please enter a room name");
    return;
  }
  if (!password) {
    showToast("Please enter the room password");
    return;
  }

  const roomId = sanitizeRoomId(roomName);
  if (!roomId) {
    showToast("Please enter a valid room name");
    return;
  }

  if (roomId === "common_room") {
    currentRoom = COMMON_ROOM;
    try {
      localStorage.setItem("comms_current_room", JSON.stringify(currentRoom));
    } catch (e) {}
    closeJoinRoomModal();
    showToast("Joined Common Chat Room");
    switchView("chat");
    return;
  }

  submitJoinRoomBtn.disabled = true;
  submitJoinRoomBtn.textContent = "Joining...";

  try {
    const roomDocRef = db.collection("custom_rooms").doc(roomId);
    const docSnap = await roomDocRef.get();

    if (!docSnap.exists) {
      showToast("Room not found. Check the name or create a new room.");
      submitJoinRoomBtn.disabled = false;
      submitJoinRoomBtn.textContent = "Join";
      return;
    }

    const roomData = docSnap.data();
    const enteredHash = await hashPassword(password, roomId);
    // Backward-compatible check supporting both hashed passwords and legacy plain passwords
    const isMatch = (roomData && roomData.passwordHash && roomData.passwordHash === enteredHash) ||
                    (roomData && roomData.password && roomData.password === password);

    if (!isMatch) {
      showToast("Incorrect password for this room");
      submitJoinRoomBtn.disabled = false;
      submitJoinRoomBtn.textContent = "Join";
      return;
    }

    // Mark room as authorized in this browser session
    try {
      sessionStorage.setItem("unlocked_room_" + roomId, "true");
    } catch (e) {}

    currentRoom = {
      id: roomId,
      name: roomData.name || roomName,
      isCustom: true
    };
    try {
      localStorage.setItem("comms_current_room", JSON.stringify(currentRoom));
    } catch (e) {}

    closeJoinRoomModal();
    showToast(`Joined "${currentRoom.name}"`);
    switchView("chat");
  } catch (err) {
    console.error("Join room error:", err);
    showToast("Failed to join room. Please try again.");
  } finally {
    submitJoinRoomBtn.disabled = false;
    submitJoinRoomBtn.textContent = "Join";
  }
});

// ==========================================================================
// REAL-TIME FIRESTORE CHAT
// ==========================================================================
const commonRoomRef = db.collection("incidents").doc("common_room").collection("messages");

function getRoomMessagesRef(room) {
  if (room && room.isCustom) {
    return db.collection("custom_rooms").doc(room.id).collection("messages");
  }
  return commonRoomRef;
}

function listenToChat() {
  if (chatUnsubscribe) {
    chatUnsubscribe();
    chatUnsubscribe = null;
  }

  updateChatHeaderUI();

  chatMessages.innerHTML = "";
  chatEmptyState.style.display = "block";
  chatEmptyState.textContent = currentRoom.isCustom
    ? `Welcome to ${currentRoom.name}. No messages yet.`
    : "No messages yet. Start the conversation.";
  chatMessages.appendChild(chatEmptyState);

  const messagesRef = getRoomMessagesRef(currentRoom);

  chatUnsubscribe = messagesRef
    .orderBy("timestamp", "asc")
    .limitToLast(80)
    .onSnapshot((snapshot) => {
      chatMessages.innerHTML = "";

      if (snapshot.empty) {
        chatEmptyState.style.display = "block";
        chatEmptyState.textContent = currentRoom.isCustom
          ? `Welcome to ${currentRoom.name}. No messages yet.`
          : "No messages yet. Start the conversation.";
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
    const messagesRef = getRoomMessagesRef(currentRoom);
    await messagesRef.add(newMsg);

    // Update room activity timestamp only upon real message activity
    if (currentRoom.isCustom) {
      db.collection("custom_rooms").doc(currentRoom.id).set({
        lastActive: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true }).catch(() => {});
    }

    chatMessages.scrollTop = chatMessages.scrollHeight;
  } catch (err) {
    showToast("Message failed to send");
  } finally {
    chatSendBtn.disabled = false;
    chatInput.focus();
  }
});

// Clear Messages or Delete Custom Room Action Handler
clearChatBtn.addEventListener("click", async () => {
  if (currentRoom.isCustom) {
    if (!confirm(`Are you sure you want to delete custom room "${currentRoom.name}"?`)) {
      return;
    }

    clearChatBtn.disabled = true;
    clearChatBtn.textContent = "...";

    try {
      const roomDocRef = db.collection("custom_rooms").doc(currentRoom.id);

      // 1. Delete all messages inside custom_rooms/{roomId}/messages
      const messagesSnap = await roomDocRef.collection("messages").get();
      const docs = messagesSnap.docs;
      const CHUNK_SIZE = 400;
      for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
        const batch = db.batch();
        docs.slice(i, i + CHUNK_SIZE).forEach(doc => batch.delete(doc.ref));
        await batch.commit();
      }

      // 2. Delete room document from custom_rooms
      await roomDocRef.delete();

      showToast(`Room "${currentRoom.name}" deleted`);

      // 3. Reset room state and navigate back to dashboard
      currentRoom = COMMON_ROOM;
      try {
        localStorage.removeItem("comms_current_room");
      } catch (e) {}

      switchView("dashboard");
    } catch (err) {
      console.error("Failed to delete custom room:", err);
      showToast("Failed to delete custom room");
    } finally {
      clearChatBtn.disabled = false;
      clearChatBtn.textContent = "Delete";
    }
    return;
  }

  // Common Room: Clear chat messages with chunked batch deletions
  if (!confirm("Are you sure you want to clear all chat messages in the Common Room?")) {
    return;
  }

  clearChatBtn.disabled = true;
  clearChatBtn.textContent = "...";

  try {
    const messagesRef = getRoomMessagesRef(currentRoom);
    const snapshot = await messagesRef.get();
    if (snapshot.empty) {
      showToast("Chat is already empty");
      return;
    }

    // Firestore allows max 500 operations per batch commit; chunk in batches of 400
    const docs = snapshot.docs;
    const CHUNK_SIZE = 400;
    for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
      const batch = db.batch();
      docs.slice(i, i + CHUNK_SIZE).forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    }

    chatMessages.innerHTML = "";
    chatEmptyState.style.display = "block";
    chatEmptyState.textContent = "No messages yet. Start the conversation.";
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

// URL Parameter & Deep Link Extraction
function getUrlRoomParam() {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has("room")) {
    return urlParams.get("room").trim();
  }
  const hash = window.location.hash;
  const qIdx = hash.indexOf("?");
  if (qIdx !== -1) {
    const hashParams = new URLSearchParams(hash.substring(qIdx + 1));
    if (hashParams.has("room")) {
      return hashParams.get("room").trim();
    }
  }
  return null;
}

// Bootstrap
function initApp() {
  updateUserProfileUI();
  updateChatHeaderUI();
  renderContacts();
  renderInviteContacts();
  listenToDynamicContacts();

  auth.signInAnonymously().catch(() => {});

  // Handle URL deep-linking (?room=xyz or #chat?room=xyz)
  const urlRoom = getUrlRoomParam();
  if (urlRoom) {
    const sanitized = sanitizeRoomId(urlRoom);
    if (sanitized === "common_room") {
      currentRoom = COMMON_ROOM;
      switchView("chat");
    } else {
      const isUnlocked = sessionStorage.getItem("unlocked_room_" + sanitized) === "true";
      if (isUnlocked) {
        currentRoom = {
          id: sanitized,
          name: urlRoom,
          isCustom: true
        };
        switchView("chat");
      } else {
        switchView("dashboard");
        setTimeout(() => {
          openJoinRoomModal();
          joinRoomNameInput.value = urlRoom;
          joinRoomPasswordInput.focus();
        }, 300);
      }
    }
  } else if (window.location.hash.startsWith("#chat")) {
    switchView("chat");
  } else {
    switchView("dashboard");
  }
}

initApp();
