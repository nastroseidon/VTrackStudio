import { expect, test as base, type ConsoleMessage, type Request, type Response } from "@playwright/test";

const missingGoogleMapsKeyError = /Google Maps JavaScript API error: MissingKeyMapError/;

function isApplicationUrl(url: string, baseURL: string | undefined) {
  return Boolean(baseURL && new URL(url).origin === new URL(baseURL).origin);
}

export const test = base.extend({
  page: async ({ page, baseURL }, runFixture) => {
    const errors: string[] = [];

    const onConsole = (message: ConsoleMessage) => {
      if (message.type() !== "error") return;
      const text = message.text();

      // The only allowed console error is Google's documented missing-key response in keyless local development.
      if (missingGoogleMapsKeyError.test(text)) return;
      errors.push(`console: ${text}`);
    };
    const onResponse = (response: Response) => {
      if (isApplicationUrl(response.url(), baseURL) && response.status() >= 400) {
        errors.push(`response: ${response.status()} ${response.url()}`);
      }
    };
    const onRequestFailed = (request: Request) => {
      if (isApplicationUrl(request.url(), baseURL)) {
        errors.push(`request failed: ${request.url()} (${request.failure()?.errorText ?? "unknown"})`);
      }
    };

    page.on("console", onConsole);
    page.on("response", onResponse);
    page.on("requestfailed", onRequestFailed);
    await runFixture(page);
    expect(errors, "unexpected browser console or application network failures").toEqual([]);
  }
});

export { expect } from "@playwright/test";
