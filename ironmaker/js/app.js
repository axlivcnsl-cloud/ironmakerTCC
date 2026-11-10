lucide.createIcons();

const menuToggle = document.getElementById("menuToggle");
const navMenu = document.getElementById("navMenu");
menuToggle.addEventListener("click", () => {
    const opened = navMenu.classList.toggle("nav-open");
    menuToggle.setAttribute("aria-expanded", String(opened));
    menuToggle.innerHTML = opened ? '<i data-lucide="x"></i>' : '<i data-lucide="menu"></i>';
    lucide.createIcons();
});
document.querySelectorAll(".nav-item").forEach(link => link.addEventListener("click", () => {
    navMenu.classList.remove("nav-open");
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.innerHTML = '<i data-lucide="menu"></i>';
    lucide.createIcons();
}));