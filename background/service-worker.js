// Service Worker for SESS Shirazu Auto Login (Manifest V3)

chrome.runtime.onInstalled.addListener(async (details) => {
  const defaults = {
    autoLogin: true,
    autoResetCaptcha: true,
    delayMs: 300,
    username: "",
    password: ""
  };

  const stored = await chrome.storage.local.get(Object.keys(defaults));
  const toUpdate = {};
  for (const [key, value] of Object.entries(defaults)) {
    if (stored[key] === undefined) {
      toUpdate[key] = value;
    }
  }

  if (Object.keys(toUpdate).length > 0) {
    await chrome.storage.local.set(toUpdate);
  }
});

// Helper function to remove all cookies for SESS Shirazu
async function clearSessCookies() {
  let removedCount = 0;
  try {
    const domains = ["sess.shirazu.ac.ir", ".sess.shirazu.ac.ir", "shirazu.ac.ir", ".shirazu.ac.ir"];
    
    for (const domain of domains) {
      const cookies = await chrome.cookies.getAll({ domain });
      for (const cookie of cookies) {
        const protocol = cookie.secure ? "https:" : "http:";
        const cleanDomain = cookie.domain.replace(/^\./, "");
        const cookieUrl = `${protocol}//${cleanDomain}${cookie.path}`;
        
        await chrome.cookies.remove({
          url: cookieUrl,
          name: cookie.name,
          storeId: cookie.storeId
        });
        removedCount++;
      }
    }
    return { success: true, count: removedCount };
  } catch (err) {
    console.error("Error clearing SESS cookies:", err);
    return { success: false, error: err.message, count: removedCount };
  }
}

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "clearSessCookies") {
    (async () => {
      const result = await clearSessCookies();
      sendResponse(result);
    })();
    return true; // Keep message channel open for async response
  }

  if (message.action === "clearCookiesAndReload") {
    (async () => {
      const result = await clearSessCookies();
      if (sender.tab?.id) {
        await chrome.tabs.reload(sender.tab.id);
      }
      sendResponse({ ...result, reloaded: true });
    })();
    return true;
  }

  if (message.action === "getCookieCount") {
    (async () => {
      try {
        const cookies = await chrome.cookies.getAll({ domain: "sess.shirazu.ac.ir" });
        sendResponse({ count: cookies.length });
      } catch (err) {
        sendResponse({ count: 0, error: err.message });
      }
    })();
    return true;
  }
});
