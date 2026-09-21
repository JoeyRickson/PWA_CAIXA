import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

import { firebaseConfig } from "./firebase-config.js";

const AUTH_MODE_KEY = "saldoplan.authMode.v1";

const $ = (selector) => document.querySelector(selector);

const gate = $("#authGate");
const gateMessage = $("#authGateMessage");
const googleButton = $("#authGoogleBtn");
const offlineButton = $("#authOfflineBtn");

const accountQuick = $("#accountQuickBtn");
const accountQuickAvatar = $("#accountQuickAvatar");
const accountQuickName = $("#accountQuickName");

const accountState = $("#accountState");
const accountName = $("#accountName");
const accountEmail = $("#accountEmail");
const accountAvatar = $("#accountAvatar");
const accountGoogleBtn = $("#accountGoogleBtn");
const accountOfflineBtn = $("#accountOfflineBtn");
const accountSignOutBtn = $("#accountSignOutBtn");

function configReady() {
  const required = ["apiKey", "authDomain", "projectId", "appId"];
  return required.every((key) => {
    const value = String(firebaseConfig?.[key] || "").trim();
    return value && !value.startsWith("COLE_");
  });
}

function setGateVisible(visible) {
  if (!gate) return;
  gate.classList.toggle("hidden", !visible);
  document.body.classList.toggle("auth-gate-open", visible);
}

function setGateStatus(message = "", error = false) {
  if (!gateMessage) return;
  gateMessage.textContent = message;
  gateMessage.classList.toggle("error-text", error);
}

function renderAvatar(img, user) {
  if (!img) return;

  if (user?.photoURL) {
    img.src = user.photoURL;
    img.alt = user.displayName || "Conta Google";
    img.classList.remove("hidden");
  } else {
    img.removeAttribute("src");
    img.alt = "";
    img.classList.add("hidden");
  }
}

function openDataView() {
  const dataButton = document.querySelector('[data-nav="data"]');
  dataButton?.click();
}

function fillDriveEmail(user) {
  if (!user?.email) return;

  const input = $("#googleEmailHint");
  if (input && !input.value.trim()) {
    input.value = user.email;
  }
}

function renderSignedIn(user) {
  window.saldoPlanAuthUser = {
    uid: user.uid,
    displayName: user.displayName || "",
    email: user.email || "",
    photoURL: user.photoURL || ""
  };

  const displayName =
    user.displayName ||
    user.email?.split("@")[0] ||
    "Conta Google";

  localStorage.setItem(AUTH_MODE_KEY, "google");
  setGateVisible(false);
  setGateStatus("");

  if (accountQuick) {
    accountQuick.classList.remove("hidden");
    accountQuick.title = user.email || "Conta Google";
  }

  if (accountQuickName) {
    accountQuickName.textContent = displayName.split(" ")[0];
  }

  renderAvatar(accountQuickAvatar, user);

  if (accountState) {
    accountState.textContent = "Conectado";
    accountState.classList.add("ok");
  }

  if (accountName) accountName.textContent = displayName;
  if (accountEmail) accountEmail.textContent = user.email || "";

  renderAvatar(accountAvatar, user);

  accountGoogleBtn?.classList.add("hidden");
  accountOfflineBtn?.classList.add("hidden");
  accountSignOutBtn?.classList.remove("hidden");

  fillDriveEmail(user);

  const driveAccountLabel = document.querySelector("#driveAccountLabel");
  if (driveAccountLabel) driveAccountLabel.textContent = user.email || displayName;
}

function renderOffline() {
  window.saldoPlanAuthUser = null;
  localStorage.setItem(AUTH_MODE_KEY, "offline");
  setGateVisible(false);

  if (accountQuick) {
    accountQuick.classList.remove("hidden");
    accountQuick.title = "Modo offline";
  }

  if (accountQuickName) accountQuickName.textContent = "Offline";
  accountQuickAvatar?.classList.add("hidden");

  if (accountState) {
    accountState.textContent = "Modo offline";
    accountState.classList.remove("ok");
  }

  if (accountName) accountName.textContent = "Sem conta conectada";

  if (accountEmail) {
    accountEmail.textContent =
      "Os dados continuam salvos somente neste aparelho.";
  }

  accountAvatar?.classList.add("hidden");

  accountGoogleBtn?.classList.remove("hidden");
  accountOfflineBtn?.classList.add("hidden");
  accountSignOutBtn?.classList.add("hidden");

  const driveAccountLabel = document.querySelector("#driveAccountLabel");
  if (driveAccountLabel) driveAccountLabel.textContent = "Modo offline";
}

function renderSignedOut() {
  window.saldoPlanAuthUser = null;
  accountQuick?.classList.add("hidden");

  if (accountState) {
    accountState.textContent = "Não conectado";
    accountState.classList.remove("ok");
  }

  if (accountName) accountName.textContent = "Entre com sua conta Google";

  if (accountEmail) {
    accountEmail.textContent =
      "O login identifica sua conta. O Google Drive continua separado e opcional.";
  }

  accountAvatar?.classList.add("hidden");

  accountGoogleBtn?.classList.remove("hidden");
  accountOfflineBtn?.classList.remove("hidden");
  accountSignOutBtn?.classList.add("hidden");

  const driveAccountLabel = document.querySelector("#driveAccountLabel");
  if (driveAccountLabel) driveAccountLabel.textContent = "Entre com Google no SaldoPlan";

  if (localStorage.getItem(AUTH_MODE_KEY) !== "offline") {
    setGateVisible(true);
  }
}

offlineButton?.addEventListener("click", renderOffline);
accountOfflineBtn?.addEventListener("click", renderOffline);
accountQuick?.addEventListener("click", openDataView);

if (!configReady()) {
  setGateStatus(
    "Firebase ainda não foi configurado. Você pode continuar offline.",
    true
  );

  googleButton?.setAttribute("disabled", "disabled");
  accountGoogleBtn?.setAttribute("disabled", "disabled");

  if (localStorage.getItem(AUTH_MODE_KEY) === "offline") {
    renderOffline();
  } else {
    renderSignedOut();
  }
} else {
  const firebaseApp = initializeApp(firebaseConfig);
  const auth = getAuth(firebaseApp);

  auth.useDeviceLanguage();

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch (error) {
    console.warn("Persistência do login não pôde ser configurada:", error);
  }

  try {
    await getRedirectResult(auth);
  } catch (error) {
    console.error("Erro ao concluir login por redirecionamento:", error);
    setGateStatus(
      error?.message || "Não foi possível concluir o login com Google.",
      true
    );
  }
  async function loginWithGoogle() {
    setGateStatus("Abrindo o login do Google…");
    googleButton?.setAttribute("disabled", "disabled");
    accountGoogleBtn?.setAttribute("disabled", "disabled");

    try {
      await signInWithPopup(auth, provider);
      setGateStatus("");
    } catch (error) {
      console.error("Erro no login Google:", error);

      if (error?.code === "auth/popup-blocked") {
        setGateStatus("Pop-up bloqueado. Redirecionando para o Google…");

        await signInWithRedirect(auth, provider);
        return;
      }

      const messages = {
        "auth/popup-closed-by-user":
          "O login foi fechado antes de terminar.",
        "auth/cancelled-popup-request":
          "Já existe uma tentativa de login em andamento.",
        "auth/unauthorized-domain":
          "Este domínio ainda não foi autorizado no Firebase.",
        "auth/network-request-failed":
          "Não foi possível acessar o Google. Verifique sua conexão."
      };

      setGateStatus(
        messages[error?.code] ||
          error?.message ||
          "Não foi possível entrar com Google.",
        true
      );
    } finally {
      googleButton?.removeAttribute("disabled");
      accountGoogleBtn?.removeAttribute("disabled");
    }
  }

  googleButton?.addEventListener("click", loginWithGoogle);
  accountGoogleBtn?.addEventListener("click", loginWithGoogle);

  accountSignOutBtn?.addEventListener("click", async () => {
    await signOut(auth);
    localStorage.removeItem(AUTH_MODE_KEY);
    renderSignedOut();
  });

  onAuthStateChanged(auth, (user) => {
    if (user) {
      renderSignedIn(user);
      return;
    }

    if (localStorage.getItem(AUTH_MODE_KEY) === "offline") {
      renderOffline();
      return;
    }

    renderSignedOut();
  });
}
