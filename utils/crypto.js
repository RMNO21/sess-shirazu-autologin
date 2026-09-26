// utils/crypto.js
// Handles Web Crypto API (AES-GCM 256-bit) encryption and decryption for credentials

const SessCrypto = (function () {
  const KEY_STORAGE_NAME = "_sess_sec_key";

  // Convert ArrayBuffer / Uint8Array to Base64
  function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  // Convert Base64 to Uint8Array
  function base64ToUint8Array(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  // Get or generate local AES-GCM 256-bit key
  async function getOrCreateKey() {
    const stored = await chrome.storage.local.get(KEY_STORAGE_NAME);
    if (stored[KEY_STORAGE_NAME]) {
      // Import existing key from JWK format
      return await crypto.subtle.importKey(
        "jwk",
        stored[KEY_STORAGE_NAME],
        { name: "AES-GCM" },
        false,
        ["encrypt", "decrypt"]
      );
    }

    // Generate a fresh cryptographically strong 256-bit AES-GCM key
    const newKey = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );

    // Export and save JWK in chrome.storage.local
    const exportedJwk = await crypto.subtle.exportKey("jwk", newKey);
    await chrome.storage.local.set({ [KEY_STORAGE_NAME]: exportedJwk });

    return newKey;
  }

  // Encrypt plaintext password
  async function encryptPassword(plainText) {
    if (!plainText) return null;
    const key = await getOrCreateKey();
    const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV
    const encoded = new TextEncoder().encode(plainText);

    const cipherBuffer = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      encoded
    );

    return {
      cipher: arrayBufferToBase64(cipherBuffer),
      iv: arrayBufferToBase64(iv)
    };
  }

  // Decrypt cipher password
  async function decryptPassword(cipherBase64, ivBase64) {
    if (!cipherBase64 || !ivBase64) return "";
    try {
      const key = await getOrCreateKey();
      const iv = base64ToUint8Array(ivBase64);
      const cipherBytes = base64ToUint8Array(cipherBase64);

      const decryptedBuffer = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        key,
        cipherBytes
      );

      return new TextDecoder().decode(decryptedBuffer);
    } catch (err) {
      console.error("Decryption failed:", err);
      return "";
    }
  }

  // Helper to get decrypted password with auto-migration from legacy plaintext
  async function getDecryptedCredentials() {
    const data = await chrome.storage.local.get([
      "username",
      "password",
      "encPassword",
      "encIv",
      "autoLogin",
      "autoResetCaptcha"
    ]);

    let password = "";
    // If encrypted password exists, decrypt it
    if (data.encPassword && data.encIv) {
      password = await decryptPassword(data.encPassword, data.encIv);
    } else if (data.password) {
      // Legacy plaintext password found -> auto-migrate to encrypted
      password = data.password;
      const encrypted = await encryptPassword(password);
      if (encrypted) {
        await chrome.storage.local.set({
          encPassword: encrypted.cipher,
          encIv: encrypted.iv
        });
        await chrome.storage.local.remove("password");
      }
    }

    return {
      username: data.username || "",
      password,
      autoLogin: data.autoLogin !== undefined ? data.autoLogin : true,
      autoResetCaptcha: data.autoResetCaptcha !== undefined ? data.autoResetCaptcha : true
    };
  }

  // Helper to save encrypted credentials
  async function saveCredentials(username, plainPassword, autoLogin, autoResetCaptcha) {
    const encrypted = await encryptPassword(plainPassword);
    const toSave = {
      username,
      autoLogin,
      autoResetCaptcha
    };

    if (encrypted) {
      toSave.encPassword = encrypted.cipher;
      toSave.encIv = encrypted.iv;
    }

    await chrome.storage.local.set(toSave);
    // Ensure plaintext password key is completely wiped from storage
    await chrome.storage.local.remove("password");
  }

  return {
    encryptPassword,
    decryptPassword,
    getDecryptedCredentials,
    saveCredentials
  };
})();

// Attach to global scope for content scripts and popup scripts
if (typeof window !== "undefined") {
  window.SessCrypto = SessCrypto;
}
if (typeof globalThis !== "undefined") {
  globalThis.SessCrypto = SessCrypto;
}
