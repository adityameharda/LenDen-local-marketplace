const threadList = document.getElementById("threadList");
const chatHeader = document.getElementById("chatHeader");
const chatBody = document.getElementById("chatBody");
const chatForm = document.getElementById("chatForm");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const chatSubmitBtn = document.getElementById("chatSubmitBtn");

let currentUser = null;
let threads = [];
let activeThreadKey = null;
let pollHandle = null;
let pendingThread = null;
let editingMessageId = null;

const editIcon = `
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      d="M4 20h4.75L19 9.75 14.25 5 4 15.25V20Zm2-1.5v-2.38l8.25-8.24 2.37 2.37-8.24 8.25H6Zm11.96-9.29 1.08-1.08a1.5 1.5 0 0 0 0-2.12l-1.05-1.05a1.5 1.5 0 0 0-2.12 0l-1.08 1.08 3.17 3.17Z"
      fill="currentColor"
    />
  </svg>
`;

const deleteIcon = `
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      d="M9 3h6l1 2h4v2H4V5h4l1-2Zm1 6h2v8h-2V9Zm4 0h2v8h-2V9ZM7 9h2v8H7V9Zm0 11a2 2 0 0 1-2-2V8h14v10a2 2 0 0 1-2 2H7Z"
      fill="currentColor"
    />
  </svg>
`;

const normalizeId = (value) => (value ? String(value) : "");

const extractId = (value) => {
  if (!value) {
    return "";
  }
  return value._id || value.id || value;
};

const getCurrentUserId = () => normalizeId(extractId(currentUser));
const getChatInput = () => chatForm?.elements?.namedItem("content");

const buildThreadKey = (productId, userIdA, userIdB) => {
  const pair = [normalizeId(userIdA), normalizeId(userIdB)].sort();
  return `${normalizeId(productId)}:${pair[0]}:${pair[1]}`;
};

const getSeenKey = (userId) => `lenideni_thread_seen_${userId}`;

const getSeenMap = () => {
  try {
    const userId = getCurrentUserId();
    const raw = userId ? localStorage.getItem(getSeenKey(userId)) : null;
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    return {};
  }
};

const setSeenMap = (map) => {
  const userId = getCurrentUserId();
  if (!userId) {
    return;
  }
  localStorage.setItem(getSeenKey(userId), JSON.stringify(map));
};

const getLatestIncomingTime = (thread) => {
  const incoming = thread.messages.filter(
    (message) =>
      normalizeId(extractId(message.recipient)) === getCurrentUserId(),
  );
  if (!incoming.length) {
    return null;
  }
  return incoming.reduce((latest, message) => {
    const created = new Date(message.createdAt);
    return created > latest ? created : latest;
  }, new Date(incoming[0].createdAt));
};

const buildThreads = (messages, userId) => {
  const map = new Map();
  const currentId = normalizeId(userId);

  messages.forEach((message) => {
    const productId = normalizeId(extractId(message.product));
    const senderId = normalizeId(extractId(message.sender));
    const recipientId = normalizeId(extractId(message.recipient));
    const senderMatch = senderId && senderId === currentId;
    const recipientMatch = recipientId && recipientId === currentId;
    const otherUser = senderMatch ? message.recipient : message.sender;
    const otherUserId = normalizeId(extractId(otherUser));
    if (!productId || !otherUserId || !senderId || !recipientId) {
      return;
    }
    if (!senderMatch && !recipientMatch) {
      return;
    }

    const key = buildThreadKey(productId, senderId, recipientId);
    if (!map.has(key)) {
      map.set(key, {
        key,
        productId,
        productTitle: message.product?.title || "Listing",
        otherUser,
        otherUserId,
        messages: [],
      });
    }
    map.get(key).messages.push(message);
  });

  return Array.from(map.values()).map((thread) => {
    thread.messages.sort(
      (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
    );
    thread.lastMessage = thread.messages[thread.messages.length - 1];
    return thread;
  });
};

const applyUnreadCounts = () => {
  const seenMap = getSeenMap();
  let hasUpdates = false;

  threads.forEach((thread) => {
    let lastSeen = seenMap[thread.key] ? new Date(seenMap[thread.key]) : null;

    if (!lastSeen) {
      const latestIncoming = getLatestIncomingTime(thread);
      if (latestIncoming) {
        seenMap[thread.key] = latestIncoming.toISOString();
        lastSeen = latestIncoming;
        hasUpdates = true;
      }
    }

    thread.unreadCount = thread.messages.filter((message) => {
      if (normalizeId(extractId(message.recipient)) !== getCurrentUserId()) {
        return false;
      }
      if (!lastSeen) {
        return true;
      }
      return new Date(message.createdAt) > lastSeen;
    }).length;
  });

  if (hasUpdates) {
    setSeenMap(seenMap);
  }
};

const renderThreadList = () => {
  if (!threadList) {
    return;
  }

  if (!threads.length) {
    threadList.innerHTML = "<div class='notice'>No messages yet.</div>";
    return;
  }

  threadList.innerHTML = threads
    .map((thread) => {
      const isActive = thread.key === activeThreadKey;
      const preview = thread.lastMessage?.content || "";
      const badge =
        thread.unreadCount > 0
          ? `<span class="chat-thread-badge">${thread.unreadCount}</span>`
          : "";
      const otherName = ui.escapeHtml(thread.otherUser?.name || "User");
      return `
      <button class="chat-thread-item ${isActive ? "active" : ""}" data-thread-key="${thread.key}">
        <div class="chat-thread-title">
          ${ui.escapeHtml(thread.productTitle)}
          ${badge}
        </div>
        <div class="chat-thread-meta">${otherName} - ${ui.escapeHtml(
          preview,
        )}</div>
      </button>
    `;
    })
    .join("");

  document.querySelectorAll("[data-thread-key]").forEach((btn) => {
    btn.addEventListener("click", () => {
      setActiveThread(btn.dataset.threadKey);
    });
  });
};

const renderChat = () => {
  if (!chatBody || !chatHeader || !chatForm) {
    return;
  }

  const thread = threads.find((item) => item.key === activeThreadKey);
  if (!thread) {
    chatHeader.textContent = "Select a thread to start chatting.";
    chatBody.innerHTML = "";
    chatForm.style.display = "none";
    resetComposer();
    return;
  }

  const otherName = thread.otherUser?.name || "User";
  chatHeader.textContent = `${thread.productTitle} - ${otherName}`;
  chatBody.innerHTML = thread.messages
    .map((message) => {
      const isSelf =
        normalizeId(extractId(message.sender)) === getCurrentUserId();
      const timestamp = new Date(message.createdAt).toLocaleString();
      const messageState = [];
      if (message.isDeleted) {
        messageState.push("Deleted");
      } else if (message.editedAt) {
        messageState.push("Edited");
      }
      const canManage = isSelf && !message.isDeleted;
      const actions = canManage
        ? `
          <div class="chat-bubble-actions">
            <button class="icon-btn small" type="button" data-edit-message="${message._id}" aria-label="Edit message">
              ${editIcon}
            </button>
            <button class="icon-btn small danger" type="button" data-delete-message="${message._id}" aria-label="Delete message">
              ${deleteIcon}
            </button>
          </div>
        `
        : "";
      return `
      <div class="chat-bubble ${isSelf ? "self" : ""}">
        <div class="meta">${ui.escapeHtml(
          `${message.sender?.name || "Someone"} - ${timestamp}`,
        )}</div>
        <div class="${message.isDeleted ? "message-deleted" : ""}">${ui.escapeHtml(
          message.content,
        )}</div>
        ${
          messageState.length
            ? `<div class="chat-message-state">${ui.escapeHtml(
                messageState.join(" • "),
              )}</div>`
            : ""
        }
        ${actions}
      </div>
    `;
    })
    .join("");

  if (!thread.messages.length) {
    chatBody.innerHTML =
      "<div class='notice'>No messages yet. Send one to start the chat.</div>";
  }

  chatForm.style.display = "grid";
  bindMessageActions();
  chatBody.scrollTop = chatBody.scrollHeight;
};

const bindMessageActions = () => {
  document.querySelectorAll("[data-edit-message]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const thread = threads.find((item) => item.key === activeThreadKey);
      const message = thread?.messages.find(
        (item) => item._id === btn.dataset.editMessage,
      );
      if (!message || message.isDeleted) {
        return;
      }

      editingMessageId = message._id;
      const input = getChatInput();
      if (input) {
        input.value = message.content;
        input.focus();
      }
      if (chatSubmitBtn) {
        chatSubmitBtn.textContent = "Save";
      }
      if (cancelEditBtn) {
        cancelEditBtn.hidden = false;
      }
      ui.setNotice("messagesNotice", "Editing your message.");
    });
  });

  document.querySelectorAll("[data-delete-message]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const confirmed = window.confirm("Delete this message?");
      if (!confirmed) {
        return;
      }

      ui.setNotice("messagesNotice", "");
      try {
        await api.request(`/api/messages/${btn.dataset.deleteMessage}`, {
          method: "DELETE",
        });
        if (editingMessageId === btn.dataset.deleteMessage) {
          resetComposer();
        }
        await loadMessages();
      } catch (error) {
        ui.setNotice("messagesNotice", error.message);
      }
    });
  });
};

const resetComposer = () => {
  editingMessageId = null;
  chatForm?.reset();
  if (chatSubmitBtn) {
    chatSubmitBtn.textContent = "Send";
  }
  if (cancelEditBtn) {
    cancelEditBtn.hidden = true;
  }
};

const setActiveThread = (key) => {
  activeThreadKey = key;
  resetComposer();
  const seenMap = getSeenMap();
  const thread = threads.find((item) => item.key === key);
  if (thread) {
    const latestIncoming = getLatestIncomingTime(thread);
    if (latestIncoming) {
      seenMap[key] = latestIncoming.toISOString();
      setSeenMap(seenMap);
      thread.unreadCount = 0;
    }
  }
  renderThreadList();
  renderChat();
};

const selectThreadFromUrl = () => {
  const params = new URLSearchParams(window.location.search);
  const productId = normalizeId(params.get("productId"));
  const userId = normalizeId(params.get("userId"));
  if (!productId || !userId || !getCurrentUserId()) {
    return null;
  }
  return {
    productId,
    userId,
    key: buildThreadKey(productId, userId, getCurrentUserId()),
  };
};

const ensurePendingThread = async (selection) => {
  if (!selection) {
    pendingThread = null;
    return;
  }

  const productId = selection.productId;
  const otherUserId = selection.userId;
  let productTitle = "Listing";
  try {
    const product = await api.request(`/api/products/${productId}`);
    productTitle = product?.title || productTitle;
  } catch (error) {
    productTitle = "Listing";
  }

  pendingThread = {
    key: selection.key,
    productId,
    productTitle,
    otherUser: { _id: otherUserId, name: "User" },
    otherUserId,
    messages: [],
    lastMessage: null,
    unreadCount: 0,
  };
};

const loadMessages = async () => {
  ui.showLoader("messagesLoader", true);
  ui.setNotice("messagesNotice", "");
  try {
    const messages = await api.request("/api/messages");
    const currentId = getCurrentUserId();
    threads = buildThreads(messages, currentId).sort((a, b) => {
      return (
        new Date(b.lastMessage?.createdAt) - new Date(a.lastMessage?.createdAt)
      );
    });
    applyUnreadCounts();
    const selection = selectThreadFromUrl();
    if (selection && !threads.some((thread) => thread.key === selection.key)) {
      await ensurePendingThread(selection);
      if (pendingThread) {
        threads.unshift(pendingThread);
      }
    } else {
      pendingThread = null;
    }

    const preferredKey = activeThreadKey || selection?.key;
    if (preferredKey && threads.some((thread) => thread.key === preferredKey)) {
      activeThreadKey = preferredKey;
    } else if (!activeThreadKey && threads.length) {
      activeThreadKey = threads[0].key;
    }
    renderThreadList();
    renderChat();
  } catch (error) {
    ui.setNotice("messagesNotice", error.message);
  } finally {
    ui.showLoader("messagesLoader", false);
  }
};

const sendMessage = async (event) => {
  event.preventDefault();
  if (!activeThreadKey) {
    return;
  }
  const thread = threads.find((item) => item.key === activeThreadKey);
  if (!thread) {
    return;
  }

  const payload = Object.fromEntries(new FormData(chatForm).entries());
  payload.productId = thread.productId;
  payload.recipientId = thread.otherUserId;

  if (normalizeId(payload.recipientId) === getCurrentUserId()) {
    ui.setNotice("messagesNotice", "You cannot message yourself.");
    return;
  }

  ui.setNotice("messagesNotice", "");
  try {
    if (editingMessageId) {
      await api.request(`/api/messages/${editingMessageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: payload.content }),
      });
    } else {
      await api.request("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    resetComposer();
    await loadMessages();
  } catch (error) {
    ui.setNotice("messagesNotice", error.message);
  }
};

const init = async () => {
  currentUser = await auth.ensureUser();
  if (!currentUser) {
    ui.setNotice("messagesNotice", "Please log in to view messages.");
    if (chatForm) {
      chatForm.style.display = "none";
    }
    if (threadList) {
      threadList.innerHTML = "<div class='notice'>Please log in first.</div>";
    }
    return;
  }

  if (chatForm) {
    chatForm.addEventListener("submit", sendMessage);
  }

  if (cancelEditBtn) {
    cancelEditBtn.addEventListener("click", () => {
      resetComposer();
      ui.setNotice("messagesNotice", "");
    });
  }

  await loadMessages();

  if (!pollHandle) {
    pollHandle = window.setInterval(loadMessages, 15000);
  }
};

init();

