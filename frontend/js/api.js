const api = {
  baseUrl: "",
  getEntityId(entity) {
    if (!entity) {
      return "";
    }
    return String(entity._id || entity.id || entity);
  },
  normalizeUser(user) {
    if (!user) {
      return null;
    }
    const normalizedId = api.getEntityId(user);
    if (!normalizedId) {
      return user;
    }
    return { ...user, _id: normalizedId, id: normalizedId };
  },
  getToken() {
    return localStorage.getItem("lenideni_token");
  },
  setToken(token) {
    localStorage.setItem("lenideni_token", token);
  },
  clearToken() {
    localStorage.removeItem("lenideni_token");
  },
  getUser() {
    const raw = localStorage.getItem("lenideni_user");
    if (!raw) {
      return null;
    }
    try {
      return api.normalizeUser(JSON.parse(raw));
    } catch (error) {
      return null;
    }
  },
  setUser(user) {
    const normalizedUser = api.normalizeUser(user);
    if (!normalizedUser) {
      return;
    }
    localStorage.setItem("lenideni_user", JSON.stringify(normalizedUser));
  },
  clearUser() {
    localStorage.removeItem("lenideni_user");
  },
  clearSession() {
    api.clearToken();
    api.clearUser();
  },
  async request(path, options = {}) {
    const headers = options.headers || {};
    const token = api.getToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    const res = await fetch(`${api.baseUrl}${path}`, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401 && token) {
        api.clearSession();
        if (typeof window !== "undefined") {
          window.location.href = "/login.html";
        }
      }
      const message = data.message || "Request failed";
      throw new Error(message);
    }
    return data;
  },
};
