// Toggle Dropdown Menu Script
const menuToggle = document.getElementById("menu-toggle");
const dropdownMenu = document.getElementById("dropdown-menu");
const closeMenu = document.getElementById("close-menu");

menuToggle.addEventListener("click", function () {
  dropdownMenu.classList.toggle("active");
});

closeMenu.addEventListener("click", function () {
  dropdownMenu.classList.remove("active");
});
