const ui = {
  showLoader(id, show) {
    const loader = document.getElementById(id);
    if (loader) {
      loader.classList.toggle("active", show);
    }
  },
  setNotice(id, message) {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = message;
    }
  },
  escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  },
  currency(value) {
    const amount = Number(value) || 0;

    return `Rs. ${new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount)}`;
  },
  date(value) {
    if (!value) {
      return "";
    }

    return new Date(value).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  },
  resolveImage(images = []) {
    if (!Array.isArray(images)) {
      return "";
    }
    return images.find(Boolean) || "";
  },
};

const auth = {
  getUserId(user) {
    return api.getEntityId(user);
  },
  isLoggedIn() {
    return Boolean(api.getToken());
  },
  getUser() {
    return api.getUser();
  },
  async ensureUser() {
    const existingUser = api.getUser();
    if (!api.getToken()) {
      return existingUser;
    }
    if (existingUser?._id) {
      return existingUser;
    }
    try {
      const me = await api.request("/api/users/me");
      api.setUser(me);
      return api.getUser();
    } catch (error) {
      api.clearSession();
      return null;
    }
  },
  logout(redirectTo = "/index.html") {
    api.clearSession();
    window.location.href = redirectTo;
  },
  applyNavState(user) {
    const isLoggedIn = Boolean(user);
    document.querySelectorAll("[data-auth]").forEach((el) => {
      const mode = el.dataset.auth;
      const shouldShow =
        (mode === "user" && isLoggedIn) || (mode === "guest" && !isLoggedIn);
      el.style.display = shouldShow ? "" : "none";
    });

    document.querySelectorAll("[data-role='admin']").forEach((el) => {
      const isAdmin = user?.role === "admin";
      el.style.display = isAdmin ? "" : "none";
    });

    document.querySelectorAll("[data-logout]").forEach((btn) => {
      btn.addEventListener("click", () => auth.logout());
    });
  },
};

const sales = {
  overlay: null,
  form: null,
  select: null,
  title: null,
  helper: null,
  loader: null,
  notice: null,
  current: null,
  ensureModal() {
    if (this.overlay) {
      return;
    }

    const overlay = document.createElement("div");
    overlay.id = "saleModal";
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h3 id="saleModalTitle">Mark listing as sold</h3>
          <button class="icon-btn" type="button" id="saleModalClose" aria-label="Close">
            X
          </button>
        </div>
        <p class="meta" id="saleModalHelper"></p>
        <form id="saleModalForm" class="form-grid">
          <select class="input" id="saleBuyerSelect" name="buyerId"></select>
          <div class="hero-cta">
            <button class="btn" type="submit">Confirm sale</button>
            <button class="btn secondary" type="button" id="saleModalCancel">
              Cancel
            </button>
          </div>
        </form>
        <div id="saleModalLoader" class="loader">Saving sale...</div>
        <p id="saleModalNotice" class="notice"></p>
      </div>
    `;

    document.body.appendChild(overlay);

    this.overlay = overlay;
    this.form = document.getElementById("saleModalForm");
    this.select = document.getElementById("saleBuyerSelect");
    this.title = document.getElementById("saleModalTitle");
    this.helper = document.getElementById("saleModalHelper");
    this.loader = document.getElementById("saleModalLoader");
    this.notice = document.getElementById("saleModalNotice");

    document
      .getElementById("saleModalClose")
      .addEventListener("click", () => this.close());
    document
      .getElementById("saleModalCancel")
      .addEventListener("click", () => this.close());
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        this.close();
      }
    });
    this.form.addEventListener("submit", (event) => this.submit(event));
  },
  populateCandidates(candidates) {
    if (!this.select) {
      return;
    }

    const options = [
      `<option value="">No buyer selected</option>`,
      ...candidates.map(
        (candidate) =>
          `<option value="${ui.escapeHtml(candidate._id)}">${ui.escapeHtml(
            candidate.name || "User",
          )}${candidate.phone ? ` - ${ui.escapeHtml(candidate.phone)}` : ""}</option>`,
      ),
    ];
    this.select.innerHTML = options.join("");
  },
  close() {
    if (!this.overlay) {
      return;
    }
    this.overlay.classList.remove("open");
    this.current = null;
    ui.setNotice("saleModalNotice", "");
    ui.showLoader("saleModalLoader", false);
  },
  async openMarkSold({ productId, title, buyerId = "", onSuccess }) {
    this.ensureModal();
    this.current = { productId, onSuccess, buyerId };
    this.title.textContent = `Mark "${title}" as sold`;
    this.helper.textContent =
      "Choose the buyer if you want this listing to appear in their Purchased items. Buyers appear here after messaging about the listing.";
    this.populateCandidates([]);
    ui.setNotice("saleModalNotice", "");
    ui.showLoader("saleModalLoader", true);
    this.overlay.classList.add("open");

    try {
      const candidates = await api.request(
        `/api/products/${productId}/buyer-candidates`,
      );
      this.populateCandidates(candidates);
      if (buyerId && this.select) {
        this.select.value = buyerId;
      }
      if (!candidates.length) {
        this.helper.textContent =
          "No buyer has messaged about this listing yet. You can still mark it as sold, but it will not show up in Purchased items for anyone.";
      }
    } catch (error) {
      ui.setNotice("saleModalNotice", error.message);
    } finally {
      ui.showLoader("saleModalLoader", false);
    }
  },
  async submit(event) {
    event.preventDefault();
    if (!this.current?.productId) {
      return;
    }

    ui.showLoader("saleModalLoader", true);
    ui.setNotice("saleModalNotice", "");

    const payload = {};
    if (this.select?.value) {
      payload.buyerId = this.select.value;
    }

    try {
      const result = await api.request(
        `/api/products/${this.current.productId}/sold`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      const onSuccess = this.current.onSuccess;
      this.close();
      if (typeof onSuccess === "function") {
        await onSuccess(result);
      }
    } catch (error) {
      ui.setNotice("saleModalNotice", error.message);
    } finally {
      ui.showLoader("saleModalLoader", false);
    }
  },
};

const ensureFooter = () => {
  if (document.getElementById("siteFooter")) {
    return;
  }

  const footer = document.createElement("footer");
  footer.id = "siteFooter";
  footer.className = "site-footer";
  footer.innerHTML = `
    <div class="site-footer-inner">
      <div>
        <div class="site-footer-brand">LeniDeni Marketplace</div>
        <div class="site-footer-meta">Buy, sell, and chat securely in your local community.</div>
      </div>
      <div class="site-footer-links" aria-label="Footer links">
        <a class="site-footer-link" href="/browse.html">Browse</a>
        <a class="site-footer-link" href="/dashboard.html?create=1" data-auth="user">Create listing</a>
        <a class="site-footer-link" href="/messages.html" data-auth="user">Messages</a>
        <a class="site-footer-link" href="/register.html" data-auth="guest">Create account</a>
      </div>
      <div class="site-footer-meta">© ${new Date().getFullYear()} LeniDeni</div>
    </div>
  `;

  document.body.appendChild(footer);
};

const enhanceNavbar = () => {
  document.querySelectorAll(".navbar .container").forEach((container) => {
    if (container.dataset.navEnhanced === "1") {
      return;
    }

    const nav = container.querySelector(".nav-links");
    if (!nav) {
      return;
    }

    const centerGroup = document.createElement("div");
    centerGroup.className = "nav-links-center";

    const authGroup = document.createElement("div");
    authGroup.className = "nav-links-auth";

    [...nav.children].forEach((item) => {
      const href = (item.getAttribute("href") || "").toLowerCase();
      const isLogout = item.hasAttribute("data-logout");
      const isLogin = href.includes("/login.html");

      if (isLogout || isLogin) {
        authGroup.appendChild(item);
      } else {
        centerGroup.appendChild(item);
      }
    });

    const searchForm = document.createElement("form");
    searchForm.className = "nav-search";
    searchForm.setAttribute("role", "search");
    searchForm.setAttribute("action", "/browse.html");
    searchForm.setAttribute("method", "get");
    searchForm.innerHTML = `
      <input class="nav-search-input" type="search" name="search" placeholder="Search listings" aria-label="Search listings" />
      <button class="nav-search-btn" type="submit" aria-label="Search">
        <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M10.5 4.75a5.75 5.75 0 1 0 0 11.5 5.75 5.75 0 0 0 0-11.5Z" stroke="currentColor" stroke-width="2"/>
          <path d="m15 15 4.25 4.25" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
    `;

    const currentPath = window.location.pathname || "";
    if (currentPath.includes("/browse.html")) {
      const search = new URLSearchParams(window.location.search).get("search");
      const input = searchForm.querySelector(".nav-search-input");
      if (input && search) {
        input.value = search;
      }
    }

    nav.innerHTML = "";
    nav.appendChild(centerGroup);
    nav.appendChild(searchForm);
    nav.appendChild(authGroup);

    container.dataset.navEnhanced = "1";
  });
};

document.addEventListener("DOMContentLoaded", async () => {
  const user = await auth.ensureUser();
  enhanceNavbar();
  ensureFooter();
  auth.applyNavState(user);
});
