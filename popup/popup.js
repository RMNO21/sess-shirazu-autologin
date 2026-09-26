// Popup controller for SESS Shirazu Auto Login

document.addEventListener("DOMContentLoaded", async () => {
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");
  const autoLoginCheckbox = document.getElementById("autoLogin");
  const autoResetCaptchaCheckbox = document.getElementById("autoResetCaptcha");
  const settingsForm = document.getElementById("settingsForm");
  const btnClearCookies = document.getElementById("btnClearCookies");
  const btnOpenSess = document.getElementById("btnOpenSess");
  const statusAlert = document.getElementById("statusAlert");

  let statusTimeout = null;
  let hasExistingPassword = false;

  function showStatus(message, type = "success") {
    if (statusTimeout) clearTimeout(statusTimeout);
    statusAlert.textContent = message;
    statusAlert.className = `status-alert ${type}`;
    statusTimeout = setTimeout(() => {
      statusAlert.className = "status-alert hidden";
    }, 3500);
  }

  // Load existing settings with decryption check
  try {
    const data = await window.SessCrypto.getDecryptedCredentials();

    if (data.username) {
      usernameInput.value = data.username;
    }
    
    if (data.password) {
      hasExistingPassword = true;
      passwordInput.value = ""; // Never expose password in DOM
      passwordInput.placeholder = "•••••••• (رمز ذخیره شده - برای تغییر تایپ کنید)";
    } else {
      passwordInput.placeholder = "کلمه عبور سس را وارد کنید";
    }

    autoLoginCheckbox.checked = data.autoLogin !== undefined ? data.autoLogin : true;
    autoResetCaptchaCheckbox.checked = data.autoResetCaptcha !== undefined ? data.autoResetCaptcha : true;
  } catch (err) {
    console.error("Failed to load settings:", err);
  }

  // Save settings with AES-GCM encryption
  settingsForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = usernameInput.value.trim();
    const newPassword = passwordInput.value;
    const autoLogin = autoLoginCheckbox.checked;
    const autoResetCaptcha = autoResetCaptchaCheckbox.checked;

    if (!username) {
      showStatus("لطفاً شناسه کاربری را وارد کنید.", "error");
      return;
    }

    if (!newPassword && !hasExistingPassword) {
      showStatus("لطفاً کلمه عبور را وارد کنید.", "error");
      return;
    }

    try {
      if (newPassword) {
        // User typed a new password -> encrypt and save
        await window.SessCrypto.saveCredentials(
          username,
          newPassword,
          autoLogin,
          autoResetCaptcha
        );
        hasExistingPassword = true;
        passwordInput.value = "";
        passwordInput.placeholder = "•••••••• (رمز ذخیره شده - برای تغییر تایپ کنید)";
        showStatus("کلمه عبور جدید با رمزگذاری محلی AES-GCM ذخیره شد.");
      } else {
        // Keep existing encrypted password, update other settings
        await chrome.storage.local.set({
          username,
          autoLogin,
          autoResetCaptcha
        });
        showStatus("تنظیمات ذخیره شد (رمز عبور قبلی بدون تغییر حفظ گردید).");
      }
    } catch (err) {
      console.error("Failed to save settings:", err);
      showStatus("خطا در ذخیره اطلاعات.", "error");
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
