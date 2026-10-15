import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCredential,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

import { firebaseConfig } from "./firebase-config.js";

const AUTH_MODE_KEY = "saldoplan.authMode.v1";
const LAST_GOOGLE_ACCOUNT_KEY = "saldoplan.lastGoogleAccount.v1";
// No Android usamos exclusivamente o seletor oficial GIS, não o atalho de e-mail salvo.
const IS_ANDROID = /Android/i.test(navigator.userAgent || "");
// Cliente Web do Firebase Authentication, NAO o cliente de backup do Google Drive.
const FIREBASE_GOOGLE_WEB_CLIENT_ID = "292722512495-nlagmuoao494du6ve34jlevje0v5cor0.apps.googleusercontent.com";
const ONBOARDING_KEY = "saldoplan.onboarding.v1";

const ONBOARDING_CONTENT = {
  mobile: [
    {
      icon: "✦", title: "Seu dinheiro, mais claro", text: "No celular, o SaldoPlan mostra o que você tem hoje e o que está previsto para o mês.",
      bullets: ["Resumo: acompanhe saldo atual, projetado e valores guardados.", "Use a setinha do mês para consultar outras competências."],
      highlightTitle: "Seu ponto de partida", highlightText: "Comece pelo Resumo e vá preenchendo suas movimentações sem pressa.", preview: "none"
    },
    {
      icon: "☰", title: "Os cinco botões da parte de baixo", text: "A barra inferior é o atalho para as áreas mais usadas, sem precisar rolar o menu para o lado.",
      bullets: ["Resumo: visão do mês; Lançamentos: entradas e despesas.", "Cartões: faturas e parcelas; Calendário: datas e vencimentos.", "Mais: abra todas as outras ferramentas do SaldoPlan."],
      highlightTitle: "Toque em Mais", highlightText: "Ali você encontra Guardado, Ciclos, Fixos, Carteira, Importar, Simulações, FGTS, Dados e Sobre.", preview: "mobile"
    },
    {
      icon: "◷", title: "Planeje seus pagamentos", text: "Use Lançamentos para cadastrar valores e Calendário para conferir o que vem pela frente.",
      bullets: ["Registre entradas e gastos reais ou previstos.", "Veja faturas, recorrências e contas fixas no calendário.", "Use Mais → Dados e backup para exportar ou restaurar seus dados."],
      highlightTitle: "Dica importante", highlightText: "Dados offline ficam neste aparelho. O login Google não sincroniza lançamentos automaticamente; o backup Drive é um recurso separado.", preview: "mobile"
    },
    {
      icon: "→", title: "Como você quer começar?", text: "Escolha uma forma de entrada. Você poderá trocar de opção depois.",
      bullets: ["Google: identifica sua conta no app.", "Offline: começa sem login, mantendo dados neste aparelho."],
      highlightTitle: "Você decide", highlightText: "Backup no Google Drive é opcional e exige autorização própria.", preview: "none"
    }
  ],
  desktop: [
    {
      icon: "✦", title: "Organize suas finanças em um só lugar", text: "O SaldoPlan reúne saldo, gastos, guardado, investimentos e projeções no seu computador.",
      bullets: ["No Resumo, veja entradas, gastos e saldo projetado.", "Use a navegação por mês sem alterar períodos anteriores."],
      highlightTitle: "Comece pelo Resumo", highlightText: "O painel principal traz uma visão geral sem substituir as análises de cada aba.", preview: "none"
    },
    {
      icon: "≡", title: "Navegue pelo menu lateral", text: "No computador, as funcionalidades ficam organizadas na barra lateral à esquerda.",
      bullets: ["Clique em Lançamentos, Calendário, Cartões ou Guardado para entrar na área.", "Carteira, Patrimônio e Mercado ficam na barra lateral.", "Na parte inferior ficam Dados e backup e Sobre."],
      highlightTitle: "Uma tela por assunto", highlightText: "O menu lateral permanece acessível enquanto você consulta seus dados.", preview: "desktop"
    },
    {
      icon: "◫", title: "Controle hoje e planeje amanhã", text: "Registre valores realizados e previstos; depois acompanhe o calendário e os relatórios.",
      bullets: ["Importe extratos em Importar ou crie lançamentos manualmente.", "Organize cartões, despesas fixas, patrimônio e metas.", "Em Dados e backup você exporta ou restaura seus dados."],
      highlightTitle: "Onde seus dados ficam", highlightText: "O armazenamento local é por navegador/aparelho. Entrar com Google não sincroniza os dados automaticamente; o Drive precisa ser autorizado separadamente.", preview: "desktop"
    },
    {
      icon: "→", title: "Pronto para começar", text: "Você pode entrar com Google ou continuar sem login neste navegador.",
      bullets: ["Google: identifica sua conta no aplicativo.", "Offline: guarda os dados localmente neste navegador."],
      highlightTitle: "Você tem controle", highlightText: "O backup no Google Drive é uma escolha independente do login.", preview: "none"
    }
  ]
};

const ONBOARDING_PREVIEWS = {
  mobile: `<div class="onboarding-nav-demo"><span>▦<small>Resumo</small></span><span>≡<small>Lançamentos</small></span><span>▰<small>Cartões</small></span><span>▦<small>Calendário</small></span><span class="onboarding-preview-more">☷<small>Mais</small></span></div><div class="onboarding-preview-caption">Barra fixa na parte inferior do celular</div>`,
  desktop: `<div class="onboarding-sidebar-demo"><b>SaldoPlan</b><span>▦ &nbsp; Resumo</span><span>≡ &nbsp; Lançamentos</span><span>▦ &nbsp; Calendário</span><span>▰ &nbsp; Cartões</span><span>⚙ &nbsp; Dados e backup</span></div><div class="onboarding-preview-caption">Menu lateral do computador</div>`
};

const $ = (selector) => document.querySelector(selector);

const onboardingGate = $("#onboardingGate");
const onboardingTitle = $("#onboardingTitle");
const onboardingText = $("#onboardingText");
const onboardingBullets = $("#onboardingBullets");
const onboardingHighlightTitle = $("#onboardingHighlightTitle");
const onboardingHighlightText = $("#onboardingHighlightText");
const onboardingStepCounter = $("#onboardingStepCounter");
const onboardingDots = $("#onboardingDots");
const onboardingSkipBtn = $("#onboardingSkipBtn");
const onboardingPrevBtn = $("#onboardingPrevBtn");
const onboardingNextBtn = $("#onboardingNextBtn");
const onboardingNav = $("#onboardingNav");
const onboardingFinishActions = $("#onboardingFinishActions");
const onboardingGoogleBtn = $("#onboardingGoogleBtn");
const onboardingOfflineBtn = $("#onboardingOfflineBtn");
const onboardingReplayBtn = $("#onboardingReplayBtn");
const onboardingIcon = document.querySelector(".onboarding-icon");
const onboardingModeLabel = $("#onboardingModeLabel");
const onboardingPreview = $("#onboardingPreview");
const onboardingScroll = $("#onboardingScroll");
const onboardingResumeBtn = $("#onboardingResumeBtn");

const gate = $("#authGate");
const gateMessage = $("#authGateMessage");
const googleButton = $("#authGoogleBtn");
const lastAccountCard = $("#authLastAccount");
const lastAccountButton = $("#authLastAccountBtn");
const lastAccountName = $("#authLastAccountName");
const lastAccountEmail = $("#authLastAccountEmail");
const forgetLastAccountButton = $("#authForgetLastAccount");

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

let onboardingStep = 0;
let onboardingOrigin = "new";
let lastOnboardingMode = "";
let startGoogleLogin = async () => {};

function configReady() {
  const required = ["apiKey", "authDomain", "projectId", "appId"];
  return required.every((key) => {
    const value = String(firebaseConfig?.[key] || "").trim();
    return value && !value.startsWith("COLE_");
  });
}

function updateModalLock() {
  const shouldLock = [gate, onboardingGate].some(
    (element) => element && !element.classList.contains("hidden")
  );
  document.body.classList.toggle("auth-gate-open", shouldLock);
}

function setGateVisible(visible) {
  if (!gate) return;
  gate.classList.toggle("hidden", !visible);
  updateModalLock();
}

function setOnboardingVisible(visible) {
  if (!onboardingGate) return;
  onboardingGate.classList.toggle("hidden", !visible);
  updateModalLock();
}

function setGateStatus(message = "", error = false) {
  if (!gateMessage) return;
  gateMessage.textContent = message;
  gateMessage.classList.toggle("error-text", error);
}

function hasCompletedOnboarding() {
  return localStorage.getItem(ONBOARDING_KEY) === "done";
}

function completeOnboarding() {
  localStorage.setItem(ONBOARDING_KEY, "done");
}

function getOnboardingMode() {
  // Acompanhar o layout REAL do app, inclusive a opção Compacto no desktop.
  const effective = document.body.dataset.layoutEffective;
  if (effective === "compact") return "mobile";
  if (effective === "desktop") return "desktop";
  return window.matchMedia("(max-width: 1099px)").matches ? "mobile" : "desktop";
}

function renderOnboarding() {
  const mode = getOnboardingMode();
  const steps = ONBOARDING_CONTENT[mode];
  const step = steps[onboardingStep] || steps[0];
  if (onboardingGate) onboardingGate.dataset.onboardingMode = mode;
  if (onboardingTitle) onboardingTitle.textContent = step.title;
  if (onboardingText) onboardingText.textContent = step.text;
  if (onboardingHighlightTitle) onboardingHighlightTitle.textContent = step.highlightTitle;
  if (onboardingHighlightText) onboardingHighlightText.textContent = step.highlightText;
  if (onboardingIcon) onboardingIcon.textContent = step.icon;
  if (onboardingModeLabel) onboardingModeLabel.textContent = mode === "mobile" ? "Guia mobile" : "Guia desktop";
  if (onboardingStepCounter) onboardingStepCounter.textContent = `${onboardingStep + 1} de ${steps.length}`;

  if (onboardingBullets) {
    onboardingBullets.replaceChildren(...step.bullets.map((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      return li;
    }));
  }
  if (onboardingDots) {
    onboardingDots.replaceChildren(...steps.map((_, index) => {
      const dot = document.createElement("i");
      if (index === onboardingStep) dot.classList.add("active");
      return dot;
    }));
  }
  if (onboardingPreview) {
    const show = step.preview !== "none";
    onboardingPreview.classList.toggle("hidden", !show);
    onboardingPreview.innerHTML = show ? ONBOARDING_PREVIEWS[mode] : "";
  }

  const isLastStep = onboardingStep === steps.length - 1;
  const isReturningUser = onboardingOrigin === "app";
  if (onboardingPrevBtn) {
    onboardingPrevBtn.disabled = onboardingStep === 0;
    onboardingPrevBtn.setAttribute("aria-label", onboardingStep === 0 ? "Você está na primeira etapa" : "Voltar à etapa anterior");
  }
  onboardingNextBtn?.classList.toggle("hidden", isLastStep);
  onboardingFinishActions?.classList.toggle("hidden", !isLastStep || isReturningUser);
  onboardingResumeBtn?.classList.toggle("hidden", !isLastStep || !isReturningUser);

  if (mode !== lastOnboardingMode) lastOnboardingMode = mode;
  if (onboardingScroll) onboardingScroll.scrollTop = 0;
}

function openOnboarding(step = 0) {
  const inApp = Boolean(window.saldoPlanAuthUser) || localStorage.getItem(AUTH_MODE_KEY) === "offline";
  onboardingOrigin = inApp ? "app" : "new";
  onboardingStep = Math.max(0, Math.min(step, 3));
  renderOnboarding();
  setGateVisible(false);
  setOnboardingVisible(true);
  onboardingPrevBtn?.focus({preventScroll:true});
}

function leaveOnboarding() {
  completeOnboarding();
  setOnboardingVisible(false);
  if (onboardingOrigin === "app") return;
  renderSignedOut();
}

function refreshOnboardingMode() {
  if (onboardingGate?.classList.contains("hidden")) return;
  const mode = getOnboardingMode();
  if (mode !== lastOnboardingMode) renderOnboarding();
}

function applyGoogleAvailability() {
  const disabled = !configReady();
  [googleButton, accountGoogleBtn, onboardingGoogleBtn, lastAccountButton].forEach((button) => {
    if (!button) return;
    if (disabled) {
      button.setAttribute("disabled", "disabled");
      button.title = "Firebase ainda não foi configurado.";
    } else {
      button.removeAttribute("disabled");
      button.removeAttribute("title");
    }
  });
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

function getLastGoogleAccount() {
  try {
    const saved=JSON.parse(localStorage.getItem(LAST_GOOGLE_ACCOUNT_KEY)||'null');
    if(saved && typeof saved.email==='string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(saved.email)) {
      return {email:saved.email,name:String(saved.name||saved.email).slice(0,100)};
    }
  } catch {}
  return null;
}

function refreshLastGoogleAccount() {
  const saved=getLastGoogleAccount();
  lastAccountCard?.classList.toggle('hidden', !saved || IS_ANDROID);
  if(lastAccountName)lastAccountName.textContent=saved?.name||'';
  if(lastAccountEmail)lastAccountEmail.textContent=saved?.email||'';
}

function renderSignedIn(user) {
  completeOnboarding();
  setOnboardingVisible(false);

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
  if(user.email){
    try {localStorage.setItem(LAST_GOOGLE_ACCOUNT_KEY,JSON.stringify({email:user.email,name:displayName}));} catch {}
  }
  refreshLastGoogleAccount();
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
  accountGoogleBtn?.nextElementSibling?.classList.contains("sp314-google-identity") &&
    accountGoogleBtn.nextElementSibling.classList.add("hidden");
  accountOfflineBtn?.classList.add("hidden");
  accountSignOutBtn?.classList.remove("hidden");

  fillDriveEmail(user);

  const driveAccountLabel = document.querySelector("#driveAccountLabel");
  if (driveAccountLabel) driveAccountLabel.textContent = user.email || displayName;
  window.saldoPlanSyncAuthChanged?.(user.uid);
}

function renderOffline() {
  completeOnboarding();
  setOnboardingVisible(false);

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
  accountGoogleBtn?.nextElementSibling?.classList.contains("sp314-google-identity") &&
    accountGoogleBtn.nextElementSibling.classList.remove("hidden");
  // Quando o GIS oficial existe no Android, o botao HTML antigo permanece oculto.
  if (IS_ANDROID && accountGoogleBtn?.nextElementSibling?.classList.contains("sp314-google-identity")) {
    accountGoogleBtn.classList.add("hidden");
  }
  accountOfflineBtn?.classList.add("hidden");
  accountSignOutBtn?.classList.add("hidden");

  const driveAccountLabel = document.querySelector("#driveAccountLabel");
  if (driveAccountLabel) driveAccountLabel.textContent = "Modo offline";
  window.saldoPlanSyncAuthChanged?.(null);
}

function renderSignedOut() {
  refreshLastGoogleAccount();
  window.saldoPlanAuthUser = null;
  window.saldoPlanSyncAuthChanged?.(null);
  accountQuick?.classList.add("hidden");

  if (accountState) {
    accountState.textContent = "Não conectado";
    accountState.classList.remove("ok");
  }

  if (accountName) accountName.textContent = "Entre com sua conta Google";

  if (accountEmail) {
    accountEmail.textContent =
      "Seu login identifica a conta. O backup na nuvem é opcional.";
  }

  accountAvatar?.classList.add("hidden");

  accountGoogleBtn?.classList.remove("hidden");
  accountGoogleBtn?.nextElementSibling?.classList.contains("sp314-google-identity") &&
    accountGoogleBtn.nextElementSibling.classList.remove("hidden");
  if (IS_ANDROID && accountGoogleBtn?.nextElementSibling?.classList.contains("sp314-google-identity")) {
    accountGoogleBtn.classList.add("hidden");
  }
  accountOfflineBtn?.classList.remove("hidden");
  accountSignOutBtn?.classList.add("hidden");

  const driveAccountLabel = document.querySelector("#driveAccountLabel");
  if (driveAccountLabel) driveAccountLabel.textContent = "Entre com Google no SaldoPlan";

  if (!hasCompletedOnboarding()) {
    setGateVisible(false);
    openOnboarding(0);
    return;
  }

  setOnboardingVisible(false);
  setGateVisible(true);
}

onboardingReplayBtn?.addEventListener("click", () => openOnboarding(0));
onboardingSkipBtn?.addEventListener("click", leaveOnboarding);
onboardingResumeBtn?.addEventListener("click", leaveOnboarding);
const mobileTourBtn = $("#mobileOnboardingReplayBtn");
mobileTourBtn?.addEventListener("click", () => {
  $("#mobileMenuClose")?.click();
  openOnboarding(0);
});
$("#aboutOnboardingReplayBtn")?.addEventListener("click", () => openOnboarding(0));
window.addEventListener("resize", refreshOnboardingMode, {passive:true});
const layoutObserver = new MutationObserver(refreshOnboardingMode);
layoutObserver.observe(document.body,{attributes:true,attributeFilter:["data-layout-effective"]});
onboardingPrevBtn?.addEventListener("click", () => {
  onboardingStep = Math.max(0, onboardingStep - 1);
  renderOnboarding();
});
onboardingNextBtn?.addEventListener("click", () => {
  onboardingStep = Math.min(ONBOARDING_CONTENT[getOnboardingMode()].length - 1, onboardingStep + 1);
  renderOnboarding();
});
onboardingOfflineBtn?.addEventListener("click", renderOffline);
offlineButton?.addEventListener("click", renderOffline);
accountOfflineBtn?.addEventListener("click", renderOffline);
accountQuick?.addEventListener("click", openDataView);

applyGoogleAvailability();

if (!configReady()) {
  setGateStatus(
    "Firebase ainda não foi configurado. Você pode continuar offline.",
    true
  );

  if (localStorage.getItem(AUTH_MODE_KEY) === "offline") {
    renderOffline();
  } else {
    renderSignedOut();
  }
} else {
  const firebaseApp = initializeApp(firebaseConfig);
  const auth = getAuth(firebaseApp);
  let loginInProgress = false;

  // Android: autenticar diretamente com token de ID do Google Identity Services.
  // Evita redirecionamento e sessionStorage (erro "missing initial state").
  const useAndroidGIS = IS_ANDROID;
  let googleIdentityReady = false;
  let googleThemeObserver = null;
  // O visual do botao oficial acompanha o tema, sem mudar a credencial ou o login.
  function renderGoogleIdentityButtons(gis) {
    const googleTheme = document.body.dataset.theme === "dark" ? "filled_black" : "outline";
    for (const button of [googleButton, onboardingGoogleBtn, accountGoogleBtn]) {
      if (!button) continue;
      let holder = button.nextElementSibling;
      if (!holder?.classList.contains("sp314-google-identity")) {
        holder = document.createElement("div");
        holder.className = "sp314-google-identity sp316-themed-google";
        holder.setAttribute("aria-label", "Entrar com Google — botao oficial");
        button.insertAdjacentElement("afterend", holder);
      }
      holder.classList.add("sp316-themed-google");
      if (holder.dataset.googleTheme !== googleTheme || !holder.children.length) {
        holder.replaceChildren();
        const available = button.parentElement?.clientWidth || 320;
        const width = Math.min(400, Math.max(200, available - 24));
        gis.renderButton(holder, {
          type: "standard", theme: googleTheme, size: "large",
          shape: "pill", text: "continue_with", width
        });
        if (holder.querySelector("iframe") || holder.children.length) {
          holder.dataset.googleTheme = googleTheme;
          button.dataset.gisReady = "true";
          button.classList.add("hidden");
        } else {
          holder.remove();
          button.dataset.gisReady = "false";
          button.classList.remove("hidden");
          continue;
        }
      }
      // Em Dados e backup, uma conta ja autenticada nao precisa do botao de entrada.
      if (button === accountGoogleBtn) holder.classList.toggle("hidden", Boolean(auth.currentUser));
    }
  }


  function setLoginButtonsBusy(busy) {
    [googleButton, lastAccountButton, accountGoogleBtn, onboardingGoogleBtn].forEach(button => {
      if (button) button.disabled = busy;
    });
    if (!busy) applyGoogleAvailability();
  }

  function readableLoginError(error) {
    const messages = {
      "auth/popup-closed-by-user": "A janela do Google foi fechada. Tente novamente.",
      "auth/popup-blocked": "O navegador bloqueou a janela do Google.",
      "auth/cancelled-popup-request": "Já existe uma tentativa de login em andamento.",
      "auth/unauthorized-domain": "O domínio deste site não está autorizado no Firebase.",
      "auth/invalid-continue-uri": "O retorno do Google não está autorizado. Verifique a configuração OAuth.",
      "auth/operation-not-supported-in-this-environment": "Este navegador não permite concluir este tipo de login.",
      "auth/network-request-failed": "Não foi possível acessar o Google. Verifique sua conexão.",
      "auth/web-storage-unsupported": "Ative o armazenamento deste site para manter o login.",
      "auth/invalid-credential": "O Google não conseguiu validar sua conta. Tente escolher novamente.",
      "auth/account-exists-with-different-credential": "Esta conta usa outro método de acesso. Confira no Firebase Authentication."
    };
    return messages[error?.code] || "Não foi possível concluir a entrada com Google. Tente novamente.";
  }

  auth.useDeviceLanguage();

  function makeGoogleProvider(lastEmail='') {
    const provider=new GoogleAuthProvider();
    provider.setCustomParameters(lastEmail?{login_hint:lastEmail}:{prompt:'select_account'});
    return provider;
  }

  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch (error) {
    console.warn("Persistência do login não pôde ser configurada:", error);
  }

  // O SDK conserva a sessão Firebase no navegador. Nao reiniciar login ao abrir a pagina.
  // O cliente Google Identity Services so recebe o token no callback oficial do Google.
  function setupGoogleIdentity() {
    if (!useAndroidGIS || googleIdentityReady) return;
    const gis = window.google?.accounts?.id;
    if (!gis || typeof gis.initialize !== "function") return;
    try {
      gis.initialize({
        client_id: FIREBASE_GOOGLE_WEB_CLIENT_ID,
        callback: async (response) => {
          const token = response?.credential;
          if (!token || loginInProgress) return;
          loginInProgress = true;
          setLoginButtonsBusy(true);
          setGateStatus("Conectando sua conta Google…");
          try {
            const result = await signInWithCredential(auth, GoogleAuthProvider.credential(token));
            renderSignedIn(result.user);
          } catch (error) {
            console.error("Erro ao autenticar credencial do Google:", error?.code || error);
            setGateStatus(readableLoginError(error), true);
          } finally {
            loginInProgress = false;
            setLoginButtonsBusy(false);
          }
        },
        auto_select: false,
        use_fedcm_for_button: true,
        button_auto_select: false
      });
      googleIdentityReady = true;
      renderGoogleIdentityButtons(gis);
      // O Google renderiza em um iframe: mudancas de tema exigem renderizacao oficial.
      if (!googleThemeObserver && typeof MutationObserver !== "undefined") {
        googleThemeObserver = new MutationObserver(records => {
          if (!records.some(record => record.attributeName === "data-theme")) return;
          if (!googleIdentityReady || loginInProgress) return;
          renderGoogleIdentityButtons(gis);
        });
        googleThemeObserver.observe(document.body, {
          attributes: true, attributeFilter: ["data-theme"]
        });
      }
    } catch (error) {
      console.error("Google Identity Services indisponivel:", error);
      googleIdentityReady = false;
      setGateStatus("Não foi possível carregar o seletor Google. Abra no Chrome e tente novamente.", true);
    }
  }

  if (useAndroidGIS) {
    setupGoogleIdentity();
    const gisScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    gisScript?.addEventListener("load", setupGoogleIdentity, {once:true});
    gisScript?.addEventListener("error", () => {
      setGateStatus("O seletor Google não carregou. Verifique a conexão ou abra no Chrome.", true);
    }, {once:true});
  }

  startGoogleLogin = async (useLastAccount=false) => {
    if (loginInProgress) return;
    const last = useLastAccount ? getLastGoogleAccount() : null;
    // O Firebase recupera sessões locais sem abrir o provedor novamente.
    // Só reaproveitamos uma sessão se ela for da conta escolhida.
    if (auth.currentUser && (!useLastAccount ||
      auth.currentUser.email?.toLowerCase() === last?.email?.toLowerCase())) {
      renderSignedIn(auth.currentUser);
      return;
    }
    if (useAndroidGIS) {
      completeOnboarding();
      setOnboardingVisible(false);
      setGateVisible(true);
      if (!googleIdentityReady) setupGoogleIdentity();
      if (!googleIdentityReady) {
        setGateStatus("O seletor Google ainda não carregou. Use o Chrome e verifique a conexão.", true);
        return;
      }
      // O Google decide se exibe seletor ou apenas o botão oficial visível.
      // Nunca forçar popup do Firebase ou redirecionamento no Android.
      setGateStatus("Escolha sua conta pelo botão oficial Continuar com Google.");
      try { window.google.accounts.id.prompt(); } catch {}
      return;
    }
    const provider = makeGoogleProvider(last?.email || "");
    loginInProgress = true;
    completeOnboarding();
    setOnboardingVisible(false);
    setGateVisible(true);
    setGateStatus("Abrindo o login do Google…");
    setLoginButtonsBusy(true);

    try {
      await signInWithPopup(auth, provider);
      setGateStatus("");
    } catch (error) {
      console.error("Falha no login Google:", error);
      setGateStatus(readableLoginError(error), true);
    } finally {
      loginInProgress = false;
      setLoginButtonsBusy(false);
    }
  };

  googleButton?.addEventListener("click", () => startGoogleLogin(false));
  onboardingGoogleBtn?.addEventListener("click", () => startGoogleLogin(false));
  accountGoogleBtn?.addEventListener("click", () => startGoogleLogin(false));
  lastAccountButton?.addEventListener('click',()=>startGoogleLogin(true));
  forgetLastAccountButton?.addEventListener('click',()=>{
    localStorage.removeItem(LAST_GOOGLE_ACCOUNT_KEY);
    refreshLastGoogleAccount();
  });

  accountSignOutBtn?.addEventListener("click", async () => {
    if (useAndroidGIS) {
      try { window.google?.accounts?.id?.disableAutoSelect(); } catch {}
    }
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
