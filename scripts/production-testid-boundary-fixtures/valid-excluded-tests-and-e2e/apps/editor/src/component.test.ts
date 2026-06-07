const element = document.createElement("section");
element.dataset.testid = "component-test";

document.querySelector('[data-testid="component-test"]');
element.getAttribute("data-testid");

if (element.dataset.testid === "component-test") {
  element.textContent = "test only";
}
