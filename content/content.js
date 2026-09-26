// Hyper-fast content script for SESS Shirazu Auto Login (Instant Execution)
(function initFastSessAutoLogin() {
  if (window !== window.top) return;

  // Pre-fetch and decrypt credentials immediately in parallel at document_start
  const credentialsPromise = window.SessCrypto
    ? window.SessCrypto.getDecryptedCredentials()
    : chrome.storage.local.get(["username", "password", "autoLogin", "autoResetCaptcha"]);

  let executed = false;
  let observer = null;

  // Floating indicator (minimal and non-blocking)
  let badgeEl = null;
  function showQuickBadge(type, message) {
    if (!document.body) return;
    if (!badgeEl) {
      badgeEl = document.createElement("div");
      badgeEl.id = "sess-autologin-badge";
      document.body.appendChild(badgeEl);
    }
    badgeEl.className = type;
    badgeEl.textContent = message;
    if (type === "success" || type === "warning") {
      setTimeout(() => {
        if (badgeEl && badgeEl.parentNode) {
          badgeEl.parentNode.removeChild(badgeEl);
          badgeEl = null;
        }
      }, 3000);
    }
  }

  // Detect active Captcha in DOM
  function isCaptchaActive() {
    const edCode = document.getElementById("edCode") ||
                   document.querySelector("input[name*='Code' i]") ||
                   document.querySelector("input[name*='Captcha' i]");
    if (edCode) {
      const style = window.getComputedStyle(edCode);
      if (style.display !== "none" && style.visibility !== "hidden" && edCode.offsetParent !== null) {
        return true;
      }
    }

    const edCodeAudio = document.getElementById("edCodeAudio");
    if (edCodeAudio && edCodeAudio.offsetParent !== null) {
      return true;
    }

    const captchaImg = document.querySelector("img[src*='Captcha' i], img[src*='Code' i]");
    if (captchaImg && captchaImg.offsetParent !== null) {
      return true;
    }

    return false;
  }

  async function tryInstantLogin() {
    if (executed) return;

    const edId = document.getElementById("edId");
    const edPass = document.getElementById("edPass");
    const edEnter = document.getElementById("edEnter");

    // Elements not ready yet
    if (!edId || !edPass || !edEnter) return;

    // Check if error message is present from a previous failed submit
    const edMsg = document.getElementById("edMsg");
    const serverError = edMsg ? edMsg.textContent.trim() : "";
    if (serverError.length > 0) {
      executed = true;
      if (observer) observer.disconnect();
      sessionStorage.removeItem("sess_reset_tried");
      showQuickBadge("error", `خطای سامانه: ${serverError} (ورود خودکار متوقف شد)`);
      return;
    }

    const settings = await credentialsPromise;
    const {
      username = "",
      password = "",
      autoLogin = true,
      autoResetCaptcha = true
    } = settings;

    // Check for captcha
    if (isCaptchaActive()) {
      executed = true;
      if (observer) observer.disconnect();

      if (autoResetCaptcha) {
        const alreadyReset = sessionStorage.getItem("sess_reset_tried") === "true";
        if (!alreadyReset) {
          sessionStorage.setItem("sess_reset_tried", "true");
          showQuickBadge("loading", "کد امنیتی شناسایی شد. بازنشانی فوق‌سریع سشن بدون کپچا...");
          chrome.runtime.sendMessage({ action: "clearCookiesAndReload" });
          return;
        } else {
          showQuickBadge("warning", "کپچا فعال است. لطفاً کد امنیتی را دستی وارد کنید.");
          return;
        }
      } else {
        showQuickBadge("warning", "کپچا فعال است. لطفاً کد امنیتی را دستی وارد کنید.");
        return;
      }
    }

    // Clean state - clear reset flag
    sessionStorage.removeItem("sess_reset_tried");

    if (!autoLogin) {
      executed = true;
      if (observer) observer.disconnect();
      return;
    }

    if (!username || !password) {
      executed = true;
      if (observer) observer.disconnect();
      showQuickBadge("warning", "شناسه یا رمز در افزونه ثبت نشده است.");
      return;
    }

    // INSTANT EXECUTION (0ms latency)
    executed = true;
    if (observer) observer.disconnect();

    // Fill inputs instantly
    edId.value = username;
    edPass.value = password;

    // Fire standard input/change events synchronously
    edId.dispatchEvent(new Event("input", { bubbles: true }));
    edId.dispatchEvent(new Event("change", { bubbles: true }));
    edPass.dispatchEvent(new Event("input", { bubbles: true }));
    edPass.dispatchEvent(new Event("change", { bubbles: true }));

    showQuickBadge("success", "ورود آنی...");

    // Click submit button immediately
    edEnter.click();
  }

  // 1. Try immediately in case DOM is already ready
  tryInstantLogin();

  // 2. Set up MutationObserver to catch inputs the exact microsecond they enter the DOM
  if (!executed && document.documentElement) {
    observer = new MutationObserver(() => {
      tryInstantLogin();
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  // 3. Fallbacks for DOM interactive and complete states
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", tryInstantLogin, { once: true });
  }
  window.addEventListener("load", tryInstantLogin, { once: true });
})();
