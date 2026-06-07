function initNavigation() {
  const nav = document.querySelector(".nav");
  if (!nav) return;

  const navLinks = Array.from(nav.querySelectorAll("a[href^='#']"));
  if (navLinks.length === 0) return;

  const sections = navLinks
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);

  // Main view update function
  function updateView(activeHash) {
    const hash = activeHash || window.location.hash || navLinks[0].getAttribute("href");

    // Update nav link active state
    navLinks.forEach((link) => {
      if (link.getAttribute("href") === hash) {
        link.classList.add("active");
        // Center the active tab in the scrolling nav bar
        link.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      } else {
        link.classList.remove("active");
      }
    });

    // Tab-based visibility for both mobile and desktop
    sections.forEach((section) => {
      if ("#" + section.id === hash) {
        section.classList.add("active");
      } else {
        section.classList.remove("active");
      }
    });
  }

  // Handle click on nav links
  navLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const targetId = link.getAttribute("href");

      // Update URL hash without jumping
      history.pushState(null, null, targetId);
      updateView(targetId);

      // Scroll nav to the top of viewport so tab content is fully visible
      const navRect = nav.getBoundingClientRect();
      const absoluteNavTop = window.scrollY + navRect.top;
      window.scrollTo({
        top: absoluteNavTop,
        behavior: "smooth"
      });
    });
  });

  // Handle browser back/forward buttons
  window.addEventListener("hashchange", () => {
    updateView();
    const navRect = nav.getBoundingClientRect();
    const absoluteNavTop = window.scrollY + navRect.top;
    window.scrollTo({
      top: absoluteNavTop,
      behavior: "smooth"
    });
  });

  // Initialize view
  updateView();
}

// Run as soon as DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initNavigation);
} else {
  initNavigation();
}
