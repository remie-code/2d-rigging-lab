export const discloseLegacyDebugQuarantineForE2e = async (page) => {
  if (page.__editorE2eInternalSurfacesDisclosureScriptInstalled !== true) {
    await page.client.call("Page.addScriptToEvaluateOnNewDocument", {
      source: `(${installInternalSurfacesDisclosure.toString()})();`
    });
    page.__editorE2eInternalSurfacesDisclosureScriptInstalled = true;
  }

  await page.evaluate(installInternalSurfacesDisclosure);
};

function installInternalSurfacesDisclosure() {
  const disclose = () => {
    for (const host of document.querySelectorAll(
      '.editor-internal-surfaces[data-internal-surfaces="true"]'
    )) {
      if (!(host instanceof HTMLElement)) {
        continue;
      }

      if (host.hidden) {
        host.hidden = false;
      }
      if (host.hasAttribute("hidden")) {
        host.removeAttribute("hidden");
      }
      if (host.getAttribute("aria-hidden") !== "false") {
        host.setAttribute("aria-hidden", "false");
      }
      if (host.dataset.e2eInternalSurfacesDisclosed !== "true") {
        host.dataset.e2eInternalSurfacesDisclosed = "true";
      }
    }
  };

  disclose();

  if (window.__editorE2eInternalSurfacesDisclosureInstalled === true) {
    return;
  }

  window.__editorE2eInternalSurfacesDisclosureInstalled = true;
  new MutationObserver(disclose).observe(document.documentElement ?? document, {
    attributes: true,
    attributeFilter: ["hidden", "aria-hidden"],
    childList: true,
    subtree: true
  });
}
