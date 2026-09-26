// Popup controller for SESS Shirazu Auto Login

document.addEventListener("DOMContentLoaded", async () => {
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");
  const autoLoginCheckbox = document.getElementById("autoLogin");
  const autoResetCaptchaCheckbox = document.getElementById("autoResetCaptcha");
  const togglePasswordBtn = document.getElementById("togglePassword");
  const settingsForm = document.getElementById("settingsForm");
  const btnClearCookies = document.getElementById("btnClearCookies");
  const btnOpenSess = document.getElementById("btnOpenSess");
  const statusAlert = document.getElementById("statusAlert");
  const eyeIcon = document.getElementById("eyeIcon");

  let statusTimeout = null;
  function showStatus(message, type = "success") {
    if (statusTimeout) clearTimeout(statusTimeout);
    statusAlert.textContent = message;
    statusAlert.className = `status-alert ${type}`;
    statusTimeout = setTimeout(() => {
      statusAlert.className = "status-alert hidden";
    }, 3500);
  }

  // Load existing settings with decryption
  try {
    const data = await window.SessCrypto.getDecryptedCredentials();

    if (data.username) usernameInput.value = data.username;
    if (data.password) passwordInput.value = data.password;
    autoLoginCheckbox.checked = data.autoLogin !== undefined ? data.autoLogin : true;
    autoResetCaptchaCheckbox.checked = data.autoResetCaptcha !== undefined ? data.autoResetCaptcha : true;
  } catch (err) {
    console.error("Failed to load settings:", err);
  }

  // Toggle password visibility
  togglePasswordBtn.addEventListener("click", () => {
    const isPassword = passwordInput.type === "password";
    passwordInput.type = isPassword ? "text" : "password";

    if (isPassword) {
      // Eye with slash icon (hide)
      eyeIcon.innerHTML = `
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
        <line x1="1" y1="1" x2="23" y2="23"></line>
      `;
    } else {
      // Normal eye icon (show)
      eyeIcon.innerHTML = `
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
        <circle cx="12" cy="12" r="3"></circle>
      `;
    }
  });

  // Save settings with AES-GCM encryption
  settingsForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    const autoLogin = autoLoginCheckbox.checked;
    const autoResetCaptcha = autoResetCaptchaCheckbox.checked;

    if (!username || !password) {
      showStatus("لطفاً نام کاربری و رمز عبور را وارد کنید.", "error");
      return;
    }

    try {
      await window.SessCrypto.saveCredentials(
        username,
        password,
        autoLogin,
        autoResetCaptcha
      );
      showStatus("اطلاعات با رمزگذاری محلی AES-GCM با موفقیت ذخیره شد.");
    } catch (err) {
      console.error("Failed to save settings:", err);
      showStatus("خطا در ذخیره اطلاعات رمزگذاری‌شده.", "error");
    }
  });

  // Clear cookies manually
  btnClearCookies.addEventListener("click", async () => {
    btnClearCookies.disabled = true;
    showStatus("در حال پاکسازی کوکی‌های سس...", "success");

    try {
      const response = await chrome.runtime.sendMessage({ action: "clearSessCookies" });
      if (response && response.success) {
        showStatus(`سشن با موفقیت پاک شد (${response.count} کوکی حذف شد).`);
      } else {
        showStatus("پاکسازی سشن انجام شد.");
      }
    } catch (err) {
      console.error("Error clearing cookies:", err);
      showStatus("خطا در برقراری ارتباط با سرویس پس‌زمینه.", "error");
    } finally {
      btnClearCookies.disabled = false;
    }
  });

  // Open SESS in new tab
  btnOpenSess.addEventListener("click", () => {
    chrome.tabs.create({ url: "https://sess.shirazu.ac.ir" });
  });
});
