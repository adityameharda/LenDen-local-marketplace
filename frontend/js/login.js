const loginForm = document.getElementById("loginForm");

const initExpiredSessionNotice = () => {
  const params = new URLSearchParams(window.location.search);
  if (params.get("expired") === "1") {
    ui.setNotice("authNotice", "Session expired. Please log in again.");
  }
};

initExpiredSessionNotice();

if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    ui.showLoader("authLoader", true);
    ui.setNotice("authNotice", "");

    const payload = Object.fromEntries(new FormData(loginForm).entries());

    try {
      const data = await api.request("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      api.setToken(data.token);
      if (data.user) {
        api.setUser(data.user);
      }
      window.location.href = "/dashboard.html";
    } catch (error) {
      ui.setNotice("authNotice", error.message);
    } finally {
      ui.showLoader("authLoader", false);
    }
  });
}
