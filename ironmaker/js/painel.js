// ==========================================
// IRONMAKER - integração com Raspberry Pi Pico W
// ==========================================

const PICO_BASE_URL = "http://192.168.15.8";
const STATUS_INTERVAL_MS = 2500;
const lucide = window.lucide;

const devices = [
  { id: "sala", name: "Luz da Sala", icon: "lightbulb", mode: "manual", automatic: false, on: null },
  { id: "garagem", name: "Luz da Garagem", icon: "lightbulb", mode: "manual", automatic: false, on: null },
  { id: "quarto", name: "Luz do Quarto", icon: "bed-double", mode: "auto", automatic: true, on: null },
  { id: "jardim", name: "Luz do Jardim", icon: "flower-2", mode: "auto", automatic: true, on: null },
  { id: "ventilador", name: "Ventilador", icon: "fan", mode: "auto", automatic: true, on: null }
];

let lastStatus = null;
let requestInProgress = false;

// Elementos principais
const sidebar = document.getElementById("sidebar");
const overlay = document.getElementById("overlay");
const menuButton = document.getElementById("menuButton");
const pageTitle = document.getElementById("pageTitle");

// ------------------------------------------
// MENU MOBILE
// ------------------------------------------
function openMenu() {
  sidebar.classList.remove("-translate-x-full");
  overlay.classList.remove("hidden");
}
function closeMenu() {
  sidebar.classList.add("-translate-x-full");
  overlay.classList.add("hidden");
}
menuButton?.addEventListener("click", openMenu);
overlay?.addEventListener("click", closeMenu);

// ------------------------------------------
// NAVEGAÇÃO
// ------------------------------------------
const navButtons = document.querySelectorAll(".nav-button");
const sections = document.querySelectorAll(".page-section");

function changePage(sectionName) {
  sections.forEach(section => section.classList.add("hidden"));
  const selectedSection = document.getElementById(sectionName);
  if (!selectedSection) return;
  selectedSection.classList.remove("hidden");

  navButtons.forEach(button => button.classList.remove("active"));
  const selectedButton = document.querySelector(`[data-section="${sectionName}"]`);
  if (selectedButton) selectedButton.classList.add("active");

  const titles = {
    dashboard: "Dashboard",
    controle: "Controle",
    monitoramento: "Monitoramento",
    configuracoes: "Configurações"
  };
  pageTitle.textContent = titles[sectionName] || "IronMaker";
  closeMenu();
  lucide?.createIcons();
}

navButtons.forEach(button => {
  button.addEventListener("click", () => changePage(button.dataset.section));
});

document.getElementById("goControl")?.addEventListener("click", () => changePage("controle"));

// ------------------------------------------
// COMUNICAÇÃO HTTP COM O PICO W
// ------------------------------------------
async function apiRequest(route) {
  const response = await fetch(`${PICO_BASE_URL}${route}`, {
    method: "GET",
    mode: "cors",
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Pico W respondeu HTTP ${response.status} em ${route}`);
  }
  return response;
}

async function sendCommand(route) {
  try {
    await apiRequest(route);
    await fetchStatus();
    return true;
  } catch (error) {
    console.error("Falha ao enviar comando:", error);
    setConnectionState(false, error.message);
    alert("Não foi possível comunicar com o Pico W. Verifique o IP, o Wi-Fi e se o programa Python está em execução.");
    return false;
  }
}

// ------------------------------------------
// RENDERIZAÇÃO DOS DISPOSITIVOS
// ------------------------------------------
function renderQuickDevices() {
  const container = document.getElementById("quickDevices");
  if (!container) return;

  container.innerHTML = devices.map(device => {
    const isOn = device.on === true;
    const known = device.on !== null;
    return `
      <button
        type="button"
        data-device-toggle="${device.id}"
        ${known ? "" : "disabled"}
        class="rounded-2xl border border-sky-200 bg-sky-50 p-5 text-left transition hover:border-sky-300 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <div class="mb-5 flex items-center justify-between">
          <div class="flex h-10 w-10 items-center justify-center rounded-xl ${isOn ? "bg-sky-100 text-sky-600" : "bg-sky-100 text-slate-500"}">
            <i data-lucide="${device.icon}" class="h-5 w-5"></i>
          </div>
          <span class="rounded-full px-2.5 py-1 text-xs ${isOn ? "bg-sky-100 text-sky-700" : "bg-sky-100 text-slate-500"}">
            ${known ? (isOn ? "Ligado" : "Desligado") : "Sem conexão"}
          </span>
        </div>
        <p class="font-medium">${device.name}</p>
        <p class="mt-1 text-xs text-slate-500">${device.automatic && device.mode === "auto" ? "Modo automático" : "Clique para controle manual"}</p>
      </button>
    `;
  }).join("");

  container.querySelectorAll("[data-device-toggle]").forEach(button => {
    button.addEventListener("click", () => toggleDevice(button.dataset.deviceToggle));
  });
  lucide?.createIcons();
}

function renderControlDevices() {
  const container = document.getElementById("controlDevices");
  if (!container) return;

  container.innerHTML = devices.map(device => {
    const isOn = device.on === true;
    const known = device.on !== null;
    const modeText = device.automatic
      ? (device.mode === "auto" ? "Automático" : "Manual")
      : "Somente manual";

    return `
      <div class="rounded-2xl border border-sky-200 bg-sky-50 p-6">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="flex h-11 w-11 items-center justify-center rounded-xl ${isOn ? "bg-sky-100 text-sky-600" : "bg-sky-100 text-slate-500"}">
              <i data-lucide="${device.icon}" class="h-5 w-5"></i>
            </div>
            <div>
              <h4 class="font-semibold">${device.name}</h4>
              <p class="text-xs text-slate-500">${known ? (isOn ? "Funcionando normalmente" : "Dispositivo desligado") : "Aguardando conexão"}</p>
            </div>
          </div>
          <button
            type="button"
            data-device-toggle="${device.id}"
            ${known ? "" : "disabled"}
            class="relative h-7 w-12 rounded-full transition ${isOn ? "bg-sky-500" : "bg-slate-300"} disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Ligar ou desligar ${device.name}"
            aria-pressed="${isOn}"
          >
            <span class="absolute top-1 h-5 w-5 rounded-full bg-sky-50 shadow transition ${isOn ? "right-1" : "left-1"}"></span>
          </button>
        </div>
        <div class="mt-4 border-t border-sky-200 pt-4">
          <div class="flex items-center justify-between text-xs">
            <span class="text-slate-500">Modo de funcionamento</span>
            <span class="font-medium ${device.mode === "auto" ? "text-sky-600" : "text-slate-700"}">${modeText}</span>
          </div>
          ${device.automatic ? `
            <div class="mt-3 flex gap-2">
              <button type="button" data-device-mode="${device.id}" data-mode="auto"
                class="rounded-lg px-3 py-2 text-xs transition ${device.mode === "auto" ? "bg-sky-200/50 text-sky-700 ring-1 ring-sky-400" : "bg-sky-100 text-slate-600 hover:bg-sky-200"}">
                Automático
              </button>
              <button type="button" data-device-mode="${device.id}" data-mode="manual"
                class="rounded-lg px-3 py-2 text-xs transition ${device.mode === "manual" ? "bg-sky-200/50 text-sky-700 ring-1 ring-sky-400" : "bg-sky-100 text-slate-600 hover:bg-sky-200"}">
                Manual
              </button>
            </div>
          ` : `
            <p class="mt-3 text-xs text-slate-500">Este dispositivo não possui automação por sensor.</p>
          `}
        </div>
      </div>
    `;
  }).join("");

  container.querySelectorAll("[data-device-toggle]").forEach(button => {
    button.addEventListener("click", () => toggleDevice(button.dataset.deviceToggle));
  });
  container.querySelectorAll("[data-device-mode]").forEach(button => {
    button.addEventListener("click", () => setDeviceMode(button.dataset.deviceMode, button.dataset.mode));
  });
  lucide?.createIcons();
}

// ------------------------------------------
// COMANDOS DE LIGAR / DESLIGAR E MODOS
// ------------------------------------------
async function toggleDevice(deviceId) {
  const device = devices.find(item => item.id === deviceId);
  if (!device || device.on === null) return;

  // Os endpoints on/off do backend também mudam o dispositivo automatizado para manual.
  const action = device.on ? "off" : "on";
  await sendCommand(`/${device.id}/${action}`);
}

async function setDeviceMode(deviceId, mode) {
  const device = devices.find(item => item.id === deviceId);
  if (!device || !device.automatic || !["auto", "manual"].includes(mode)) return;
  await sendCommand(`/modo/${device.id}/${mode}`);
}

// ------------------------------------------
// STATUS E INDICADORES DA DASHBOARD
// ------------------------------------------
function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function setConnectionState(online, detail = "") {
  const dot = document.getElementById("sidebarStatusDot");
  const settingsDot = document.getElementById("settingsStatusDot");

  if (dot) dot.className = `h-2.5 w-2.5 rounded-full ${online ? "bg-sky-500" : "bg-red-500"}`;
  if (settingsDot) settingsDot.className = `h-2 w-2 rounded-full ${online ? "bg-sky-500" : "bg-red-500"}`;

  setText("sidebarStatusTitle", online ? "Sistema online" : "Pico W desconectado");
  setText("sidebarStatusText", online ? "Controlador respondendo" : "Verifique Wi-Fi e endereço IP");
  setText("settingsConnectionStatus", online ? "Conectado ao Pico W" : "Sem conexão com o Pico W");

  if (!online && detail) console.warn(detail);
}

function updateModuleCard(id, online, status, info, barId) {
  setText(id, status);
  setText(info, online ? (id === "picoModuleStatus" ? "API respondendo" : document.getElementById(info)?.textContent || "") : "Indisponível");
  const bar = document.getElementById(barId);
  if (bar) bar.className = `h-full rounded-full transition-all ${online ? "w-full bg-sky-500" : "w-0 bg-slate-300"}`;
}

function updateDashboardNumbers() {
  const active = devices.filter(device => device.on === true).length;
  const total = devices.length;
  const known = devices.every(device => device.on !== null);

  setText("connectedDevices", lastStatus?.online ? String(total) : "--");
  setText("activeDevices", known ? String(active) : "--");
  setText("activePercent", known ? `${Math.round((active / total) * 100)}% em funcionamento` : "Aguardando conexão");
}

function updateMonitoring(data) {
  const tempValid = data.temperatura_valida === true && Number.isFinite(Number(data.temp));
  const humidityValid = data.umidade_valida === true && Number.isFinite(Number(data.umi));
  const lightValid = data.ldr_valido === true && Number.isFinite(Number(data.luz));

  const temp = tempValid ? `${Number(data.temp).toFixed(1).replace(".", ",")}°C` : "--";
  const humidity = humidityValid ? `${Number(data.umi).toFixed(0)}%` : "--";
  const light = lightValid ? `${Number(data.luz)}%` : "--";
  const presence = data.pir_valido === true
    ? (data.presenca_detectada === true ? "Detectada" : "Ausente")
    : "--";
  const fan = data.ventilador || "--";

  setText("dashboardTemp", temp);
  setText("dashboardHumidity", humidity);

  setText("monitorTemp", temp);
  setText("monitorHumidity", humidity);
  setText("monitorLight", light);
  setText("monitorPresence", presence);
  setText("monitorFan", fan);

  setText("monitorTempInfo", tempValid ? "Leitura atual do DHT11" : "DHT11 sem leitura");
  setText("monitorHumidityInfo", humidityValid ? "Leitura atual do DHT11" : "DHT11 sem leitura");
  setText("monitorLightInfo", lightValid ? `LDR: ${data.ldr_raw} / 65535` : "LDR sem leitura");
  setText("monitorPresenceInfo", data.presenca_detectada === true ? "Movimento detectado pelo PIR" : (data.presenca_detectada === false ? "Nenhum movimento detectado" : "PIR sem leitura"));
  setText("monitorFanInfo", `Modo ${data.modo_ventilador || "--"}`);
}

function applyStatus(data) {
  lastStatus = data;
  devices.forEach(device => {
    const state = data[device.id];
    device.on = typeof state === "string"
      ? ["LIGADA", "LIGADO"].includes(state.toUpperCase())
      : null;

    if (device.automatic) {
      device.mode = data[`modo_${device.id}`] === "manual" ? "manual" : "auto";
    }
  });

  setConnectionState(data.online === true);
  setText("settingsPicoIp", `IP do Pico W: ${data.pico_ip || "não informado"}`);
  setText("picoModuleStatus", data.online ? "Online" : "Offline");
  setText("picoModuleInfo", data.pico_ip ? `IP: ${data.pico_ip}` : "IP não informado");
  setText("sensorModuleStatus", (data.temperatura_valida && data.ldr_valido) ? "Ativos" : "Parcial");
  setText("sensorModuleInfo", `DHT11: ${data.temperatura_valida ? "OK" : "--"} | LDR: ${data.ldr_valido ? "OK" : "--"} | PIR: ${data.pir_valido ? "OK" : "--"}`);
  setText("wifiModuleStatus", data.online ? "Conectado" : "Offline");
  setText("wifiModuleInfo", data.pico_ip ? `IP: ${data.pico_ip}` : "Rede indisponível");

  const picoBar = document.getElementById("picoModuleBar");
  const sensorBar = document.getElementById("sensorModuleBar");
  const wifiBar = document.getElementById("wifiModuleBar");
  if (picoBar) picoBar.className = `h-full rounded-full transition-all ${data.online ? "w-full bg-sky-500" : "w-0 bg-slate-300"}`;
  if (sensorBar) sensorBar.className = `h-full rounded-full transition-all ${(data.temperatura_valida || data.ldr_valido || data.pir_valido) ? "w-full bg-sky-500" : "w-0 bg-slate-300"}`;
  if (wifiBar) wifiBar.className = `h-full rounded-full transition-all ${data.online ? "w-full bg-sky-1000" : "w-0 bg-slate-300"}`;

  updateMonitoring(data);
  renderQuickDevices();
  renderControlDevices();
  updateDashboardNumbers();
}

async function fetchStatus() {
  if (requestInProgress) return;
  requestInProgress = true;
  try {
    const response = await apiRequest("/status");
    const data = await response.json();
    if (!data || data.online !== true) throw new Error("O Pico W não confirmou que a API está online.");
    applyStatus(data);
  } catch (error) {
    console.error("Erro ao consultar /status:", error);
    setConnectionState(false, error.message);
    devices.forEach(device => { device.on = null; });
    renderQuickDevices();
    renderControlDevices();
    updateDashboardNumbers();
  } finally {
    requestInProgress = false;
  }
}

// ------------------------------------------
// CONFIGURAÇÕES - NOTIFICAÇÕES
// ------------------------------------------
const notificationToggle = document.getElementById("notificationToggle");
notificationToggle?.addEventListener("click", () => {
  const isActive = notificationToggle.classList.contains("bg-sky-500");
  const knob = notificationToggle.querySelector("span");
  if (isActive) {
    notificationToggle.classList.remove("bg-sky-500");
    notificationToggle.classList.add("bg-slate-300");
    knob.classList.remove("right-1");
    knob.classList.add("left-1");
  } else {
    notificationToggle.classList.remove("bg-slate-300");
    notificationToggle.classList.add("bg-sky-500");
    knob.classList.remove("left-1");
    knob.classList.add("right-1");
  }
});

// Estilo dos botões de navegação (tema azul claro)
const style = document.createElement("style");
style.textContent = `
  .nav-button { color: #475569; }
  .nav-button:hover { background: #e0f2fe; color: #0f172a; }
  .nav-button.active { background: oklch(90.1% 0.058 230.902 / 50%); color: oklch(58.8% 0.158 241.966); }
`;
document.head.appendChild(style);

// ------------------------------------------
// INICIALIZAÇÃO E CONSULTA PERIÓDICA
// ------------------------------------------
renderQuickDevices();
renderControlDevices();
lucide?.createIcons();
fetchStatus();
window.setInterval(fetchStatus, STATUS_INTERVAL_MS);