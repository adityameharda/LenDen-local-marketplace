const registerForm = document.getElementById("registerForm");
const sendOtpBtn = document.getElementById("sendOtpBtn");
let otpRequestedForEmail = "";

if (sendOtpBtn && registerForm) {
  sendOtpBtn.addEventListener("click", async () => {
    const formData = new FormData(registerForm);
    const email = String(formData.get("email") || "")
      .trim()
      .toLowerCase();

    if (!email) {
      ui.setNotice("authNotice", "Please enter your email first");
      return;
    }

    sendOtpBtn.disabled = true;
    const oldText = sendOtpBtn.textContent;
    sendOtpBtn.textContent = "Sending...";
    ui.setNotice("authNotice", "");

    try {
      const data = await api.request("/api/auth/register/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      otpRequestedForEmail = email;
      ui.setNotice(
        "authNotice",
        data.message || "OTP sent. Check your email and enter the code.",
      );
    } catch (error) {
      ui.setNotice("authNotice", error.message);
    } finally {
      sendOtpBtn.disabled = false;
      sendOtpBtn.textContent = oldText;
    }
  });
}

if (registerForm) {
  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    ui.showLoader("authLoader", true);
    ui.setNotice("authNotice", "");

    const payload = Object.fromEntries(new FormData(registerForm).entries());
    payload.email = String(payload.email || "")
      .trim()
      .toLowerCase();
    payload.otp = String(payload.otp || "").trim();

    if (!payload.email) {
      ui.setNotice("authNotice", "Email is required");
      ui.showLoader("authLoader", false);
      return;
    }

    if (otpRequestedForEmail !== payload.email) {
      ui.setNotice(
        "authNotice",
        "Please send OTP for this email before creating account",
      );
      ui.showLoader("authLoader", false);
      return;
    }

    if (!/^\d{6}$/.test(payload.otp)) {
      ui.setNotice("authNotice", "Please enter a valid 6-digit OTP");
      ui.showLoader("authLoader", false);
      return;
    }

    try {
      const data = await api.request("/api/auth/register/verify-otp", {
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
