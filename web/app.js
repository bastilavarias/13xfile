if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
  document.querySelectorAll("[data-feed-link]").forEach((link) => {
    link.href = "http://127.0.0.1:8081/";
  });
}
