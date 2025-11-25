const { test, expect } = require("@playwright/test");

function formatConsoleErrors(messages) {
  return messages
    .map((msg, index) => `#${index + 1} [${msg.type}] ${msg.text}`)
    .join("\n");
}

test("Homer loads without console errors", async ({ page }) => {
  const consoleMessages = [];

  page.on("console", (msg) => {
    consoleMessages.push({ type: msg.type(), text: msg.text() });
  });

  page.on("pageerror", (error) => {
    consoleMessages.push({ type: "pageerror", text: error.message });
  });

  const response = await page.goto("/");
  expect(response?.ok()).toBeTruthy();

  await page.waitForTimeout(4000);

  const errorMessages = consoleMessages.filter((msg) =>
    ["error", "pageerror"].includes(msg.type)
  );

  if (errorMessages.length) {
    console.log("Console errors captured:\n" + formatConsoleErrors(errorMessages));
  }

  expect(
    errorMessages,
    errorMessages.length
      ? "Console errors encountered:\n" + formatConsoleErrors(errorMessages)
      : ""
  ).toEqual([]);
});
