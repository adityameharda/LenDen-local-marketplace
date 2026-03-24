const loginForm = document.getElementById("loginForm");
const forgotPasswordForm = document.getElementById("forgotPasswordForm");
const toggleForgotPasswordBtn = document.getElementById("toggleForgotPassword");
const sendResetOtpBtn = document.getElementById("sendResetOtpBtn");
const resetOtpTimerEl = document.getElementById("resetOtpTimer");
let resetOtpTimerInterval = null;

const clearResetOtpTimer = () => {
  if (resetOtpTimerInterval) {
    clearInterval(resetOtpTimerInterval);
    resetOtpTimerInterval = null;
  }
  if (resetOtpTimerEl) {
    resetOtpTimerEl.style.display = "none";
    resetOtpTimerEl.textContent = "";
  }
};

const startResetOtpTimer = (minutes) => {
  if (!resetOtpTimerEl) {
    return;
  }

  clearResetOtpTimer();

  let remainingSeconds = Math.max(0, Math.floor(minutes * 60));
  resetOtpTimerEl.style.display = "block";

  const render = () => {
    const mins = String(Math.floor(remainingSeconds / 60)).padStart(2, "0");
    const secs = String(remainingSeconds % 60).padStart(2, "0");
    resetOtpTimerEl.textContent = `OTP expires in ${mins}:${secs}`;
  };

  render();

  resetOtpTimerInterval = setInterval(() => {
    remainingSeconds -= 1;
    if (remainingSeconds <= 0) {
      clearResetOtpTimer();
      if (resetOtpTimerEl) {
        resetOtpTimerEl.style.display = "block";
        resetOtpTimerEl.textContent = "OTP expired. Please request a new OTP.";
      }
      return;
    }
    render();
  }, 1000);
};

const initExpiredSessionNotice = () => {
  const params = new URLSearchParams(window.location.search);
  if (params.get("expired") === "1") {
    ui.setNotice("authNotice", "Session expired. Please log in again.");
    return;
  }

  const message = params.get("message");
  if (message) {
    ui.setNotice("authNotice", message);
  }
};

initExpiredSessionNotice();

if (toggleForgotPasswordBtn && forgotPasswordForm) {
  toggleForgotPasswordBtn.addEventListener("click", () => {
    const isOpen = forgotPasswordForm.style.display !== "none";
    forgotPasswordForm.style.display = isOpen ? "none" : "grid";
    toggleForgotPasswordBtn.textContent = isOpen
      ? "Forgot password?"
      : "Hide reset form";

    if (isOpen) {
      clearResetOtpTimer();
    }
  });
}

if (sendResetOtpBtn && forgotPasswordForm) {
  sendResetOtpBtn.addEventListener("click", async () => {
    const formData = new FormData(forgotPasswordForm);
    const email = String(formData.get("email") || "")
      .trim()
      .toLowerCase();

    if (!email) {
      ui.setNotice("authNotice", "Enter your email to receive OTP");
      return;
    }

    sendResetOtpBtn.disabled = true;
    const oldText = sendResetOtpBtn.textContent;
    sendResetOtpBtn.textContent = "Sending...";
    ui.setNotice("authNotice", "");

    try {
      const data = await api.request("/api/auth/password/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const validity = Number(data.expiresInMinutes);
      const fallbackMessage =
        Number.isFinite(validity) && validity > 0
          ? `OTP has been sent to your email. It is valid for ${validity} minutes.`
          : "OTP has been sent to your email.";

      ui.setNotice("authNotice", data.message || fallbackMessage);

      startResetOtpTimer(
        Number.isFinite(validity) && validity > 0 ? validity : 10,
      );
    } catch (error) {
      ui.setNotice("authNotice", error.message);
      clearResetOtpTimer();
    } finally {
      sendResetOtpBtn.disabled = false;
      sendResetOtpBtn.textContent = oldText;
    }
  });
}

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

if (forgotPasswordForm) {
  forgotPasswordForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    ui.showLoader("authLoader", true);
    ui.setNotice("authNotice", "");

    const payload = Object.fromEntries(
      new FormData(forgotPasswordForm).entries(),
    );
    payload.email = String(payload.email || "")
      .trim()
      .toLowerCase();
    payload.otp = String(payload.otp || "").trim();

    if (!/^\d{6}$/.test(payload.otp)) {
      ui.setNotice("authNotice", "Please enter a valid 6-digit OTP");
      ui.showLoader("authLoader", false);
      return;
    }

    try {
      const data = await api.request("/api/auth/password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      forgotPasswordForm.reset();
      clearResetOtpTimer();
      ui.setNotice("authNotice", data.message || "Password reset successful");
    } catch (error) {
      ui.setNotice("authNotice", error.message);
    } finally {
      ui.showLoader("authLoader", false);
    }
  });
}
