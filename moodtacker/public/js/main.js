// public/js/main.js
// Highlights the active nav link based on current URL
document.addEventListener('DOMContentLoaded', () => {
  const links = document.querySelectorAll('.nav-link');
  links.forEach(link => {
    if (window.location.pathname.startsWith(link.getAttribute('href'))) {
      link.style.color = 'var(--primary)';
      link.style.background = 'var(--bg)';
    }
  });
});
