// Service worker registration and the update bar. The one place the site
// registers its worker. A new worker installs and waits; it only takes over
// when somebody presses Reload in the bar.

(function () {
  const SW_URL = "/sw.js";
  const SITE_NAME = "Stage Connect";

  const COPY = {
    label: "Update",
    ready: `A new version of ${SITE_NAME} is ready.`,
    reload: "Reload",
    later: "Not now",
  };

  let registration = null;
  let waitingWorker = null;
  let reloading = false;
  // This page view only. Never stored: "Not now" means not now.
  let dismissed = false;

  function render() {
    const existing = document.querySelector(".update-notice");

    if (!waitingWorker || dismissed) {
      if (existing) existing.remove();
      return;
    }

    const bar = existing || document.createElement("div");
    bar.className = "update-notice";
    bar.setAttribute("role", "status");
    bar.setAttribute("aria-label", COPY.label);
    bar.innerHTML = `
      <div class="update-notice-inner">
        <p>${COPY.ready}</p>
        <button type="button" class="btn btn-primary" data-sw-update>${COPY.reload}</button>
        <button type="button" class="btn btn-ghost" data-sw-later>${COPY.later}</button>
      </div>
    `;

    bar.querySelector("[data-sw-update]").addEventListener("click", () => {
      // The only place anything asks for skipWaiting. The reload happens on
      // controllerchange, not here.
      if (waitingWorker) waitingWorker.postMessage("skip-waiting");
    });

    bar.querySelector("[data-sw-later]").addEventListener("click", () => {
      dismissed = true;
      render();
    });

    if (!existing) document.body.prepend(bar);
  }

  function watchForUpdate() {
    if (!registration) return;

    // A worker already waiting when the page opened: the usual case on the
    // next visit after a deploy.
    if (registration.waiting && navigator.serviceWorker.controller) {
      waitingWorker = registration.waiting;
      render();
    }

    registration.addEventListener("updatefound", () => {
      const installing = registration.installing;
      if (!installing) return;

      installing.addEventListener("statechange", () => {
        // Installed with no controller is a first install, not an update.
        if (installing.state === "installed" && navigator.serviceWorker.controller) {
          waitingWorker = registration.waiting || installing;
          render();
        }
      });
    });
  }

  function registerWorker() {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register(SW_URL)
      .then((reg) => {
        registration = reg;
        watchForUpdate();
      })
      .catch((cause) => {
        // Private browsing and non-localhost http land here. Not fatal.
        console.warn("service worker registration failed:", cause);
      });

    // Reload once the new worker has taken over, so the page comes back on
    // the new version. The flag stops a second controllerchange looping.
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });

    // A tab left open for days never navigates, so the browser never checks
    // for a new worker. Coming back to the tab is the moment to ask.
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible" || !registration) return;
      registration.update().catch(() => {});
    });
  }

  // On load, so precaching does not compete with the page's own assets.
  if (document.readyState === "complete") registerWorker();
  else window.addEventListener("load", registerWorker, { once: true });
})();
