// ==========================================
// IRONMAKER - alternância entre modo claro e escuro
// Carregar no <head>, SEM defer/module, para evitar "flash" de tema.
// O tema escolhido fica salvo e vale para index.html e painel.html.
// ==========================================
(function () {
  var KEY = "ironmaker-theme";
  var root = document.documentElement;

  function getSaved() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }

  function save(theme) {
    try { localStorage.setItem(KEY, theme); } catch (e) { /* ignora */ }
  }

  function updateButtons(theme) {
    var dark = theme === "dark";
    document.querySelectorAll("[data-theme-toggle]").forEach(function (btn) {
      btn.setAttribute("aria-pressed", String(dark));
      btn.setAttribute("aria-label", dark ? "Ativar modo claro" : "Ativar modo escuro");
      btn.setAttribute("title", dark ? "Modo claro" : "Modo escuro");

      var label = btn.querySelector(".theme-label");
      if (!label) {
        label = document.createElement("span");
        label.className = "theme-label";
        btn.appendChild(label);
      }
      label.textContent = dark ? "Modo claro" : "Modo escuro";
    });
  }

  function apply(theme) {
    if (theme === "dark") root.setAttribute("data-theme", "dark");
    else root.removeAttribute("data-theme");
    updateButtons(theme);
  }

  // Padrão: claro (versão original do projeto)
  apply(getSaved() === "dark" ? "dark" : "light");

  document.addEventListener("DOMContentLoaded", function () {
    updateButtons(root.getAttribute("data-theme") === "dark" ? "dark" : "light");
    if (window.lucide) window.lucide.createIcons();
  });

  document.addEventListener("click", function (event) {
    var btn = event.target.closest("[data-theme-toggle]");
    if (!btn) return;
    var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    save(next);
    apply(next);
  });

  // Mantém abas abertas (index e painel) sincronizadas
  window.addEventListener("storage", function (event) {
    if (event.key === KEY) apply(event.newValue === "dark" ? "dark" : "light");
  });
})();