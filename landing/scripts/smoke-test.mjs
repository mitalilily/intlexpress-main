import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createServer } from "vite";

const baseUrl = process.env.SMOKE_BASE_URL || "http://127.0.0.1:5173";
const devPort = Number(new URL(baseUrl).port || 5173);

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function isReachable(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForReachable(url, timeout = 30000) {
  const started = Date.now();

  while (Date.now() - started < timeout) {
    if (await isReachable(url)) return;
    await delay(400);
  }

  throw new Error(`Timed out waiting for ${url}`);
}

async function runFunctionalSmokeTests() {
  globalThis.window = { setTimeout: globalThis.setTimeout };

  const server = await createServer({ logLevel: "error", server: { middlewareMode: true } });

  try {
    const calculators = await server.ssrLoadModule("/src/utils/calculators.js");
    const mockApi = await server.ssrLoadModule("/src/services/mockApi.js");
    const {
      isValidPincode,
      calculateVolumetricWeight,
      getBillableWeight,
      resolveZone,
      buildRateSummary,
      generateCourierQuotes,
    } = calculators;
    const { mockCalculateRates, mockTrackShipment } = mockApi;

    assert.equal(isValidPincode("713513"), true);
    assert.equal(isValidPincode("71351"), false);
    assert.equal(calculateVolumetricWeight(32, 24, 18), 2.76);
    assert.equal(getBillableWeight(1.8, 2.76), 2.76);
    assert.deepEqual(resolveZone("713513", "713001"), {
      label: "Local",
      baseRate: 56,
      sla: "Same or next day",
    });
    assert.deepEqual(resolveZone("713513", "700001"), {
      label: "Regional",
      baseRate: 82,
      sla: "2-3 days",
    });
    assert.deepEqual(resolveZone("713513", "110001"), {
      label: "National",
      baseRate: 128,
      sla: "3-5 days",
    });

    const prepaidForm = {
      originPincode: "713513",
      destinationPincode: "700001",
      weight: "1.2",
      length: "28",
      breadth: "22",
      height: "16",
      paymentType: "Prepaid",
    };
    const prepaidSummary = buildRateSummary(prepaidForm);
    assert.equal(prepaidSummary.valid, true);
    assert.equal(prepaidSummary.zone.label, "Regional");
    assert.equal(prepaidSummary.volumetricWeight, 1.97);
    assert.equal(prepaidSummary.billableWeight, 1.97);
    assert.equal(prepaidSummary.paymentSurcharge, 0);
    assert.equal(generateCourierQuotes(prepaidForm).length, 4);
    assert.equal(buildRateSummary({ ...prepaidForm, paymentType: "COD" }).paymentSurcharge, 32);

    const rateResponse = await mockCalculateRates(prepaidForm);
    assert.equal(rateResponse.options.length, 4);
    assert.equal(rateResponse.summary.zone.label, "Regional");
    await assert.rejects(
      () => mockCalculateRates({ ...prepaidForm, originPincode: "123" }),
      /valid pin codes/i
    );

    const activeShipment = await mockTrackShipment("IXP78254019");
    assert.equal(activeShipment.status, "Out for delivery");
    assert.equal(activeShipment.activeStep, 3);

    const deliveredShipment = await mockTrackShipment("ixp11984027");
    assert.equal(deliveredShipment.status, "Delivered");
    assert.equal(deliveredShipment.activeStep, deliveredShipment.timeline.length - 1);
    await assert.rejects(() => mockTrackShipment("BAD123"), /Tracking ID not found/i);
  } finally {
    await server.close();
  }
}

class CdpClient {
  constructor(wsUrl) {
    this.nextId = 0;
    this.pending = new Map();
    this.ws = new WebSocket(wsUrl);
    this.ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);

      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);

        if (message.error) reject(new Error(message.error.message));
        else resolve(message);
      }
    });
  }

  async open() {
    if (this.ws.readyState === WebSocket.OPEN) return;

    await new Promise((resolve, reject) => {
      this.ws.addEventListener("open", resolve, { once: true });
      this.ws.addEventListener("error", reject, { once: true });
    });
  }

  send(method, params = {}) {
    const id = ++this.nextId;
    const promise = new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP timeout for ${method}`));
        }
      }, 12000);
    });

    this.ws.send(JSON.stringify({ id, method, params }));
    return promise;
  }

  close() {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.close();
  }
}

async function waitForDevtools(port) {
  for (let index = 0; index < 80; index += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      const tabs = await response.json();
      const tab = tabs.find((item) => item.type === "page" && item.webSocketDebuggerUrl);

      if (tab) return tab.webSocketDebuggerUrl;
    } catch {
      await delay(250);
    }
  }

  throw new Error("Chrome DevTools endpoint did not become ready");
}

async function findCdpPort(startPort = 9227) {
  let port = startPort;

  while (true) {
    try {
      await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(250) });
      port += 1;
    } catch {
      return port;
    }
  }
}

function resolveChromePath() {
  return (
    process.env.CHROME_PATH ||
    process.env.GOOGLE_CHROME_BIN ||
    "C:/Program Files/Google/Chrome/Application/chrome.exe"
  );
}

async function runBrowserSmokeTests() {
  let devServerProcess;
  const alreadyRunning = await isReachable(`${baseUrl}/`);

  if (!alreadyRunning) {
    devServerProcess = spawn(
      process.platform === "win32" ? "npm.cmd" : "npm",
      ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(devPort)],
      { stdio: "ignore", windowsHide: true }
    );
    await waitForReachable(`${baseUrl}/`);
  }

  const cdpPort = await findCdpPort();
  const userDataDir = await mkdtemp(path.join(os.tmpdir(), "intlexpress-cdp-"));
  const chrome = spawn(resolveChromePath(), [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${userDataDir}`,
    "about:blank",
  ], { stdio: "ignore", windowsHide: true });

  let cdp;
  let passed = false;

  try {
    cdp = new CdpClient(await waitForDevtools(cdpPort));
    await cdp.open();
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");

    async function evalJs(expression, awaitPromise = false) {
      const response = await cdp.send("Runtime.evaluate", {
        expression,
        awaitPromise,
        returnByValue: true,
      });

      if (response.result.exceptionDetails) {
        throw new Error(response.result.exceptionDetails.text || "JS evaluation failed");
      }

      return response.result.result.value;
    }

    async function navigate(pathname) {
      await cdp.send("Page.navigate", { url: `${baseUrl}${pathname}` });

      for (let index = 0; index < 80; index += 1) {
        if ((await evalJs("document.readyState")) === "complete") return;
        await delay(250);
      }

      throw new Error(`Timed out navigating to ${pathname}`);
    }

    async function waitForText(text, context, timeout = 9000) {
      const started = Date.now();

      while (Date.now() - started < timeout) {
        if (await evalJs(`document.body.innerText.includes(${JSON.stringify(text)})`)) return;
        await delay(200);
      }

      const body = await evalJs("document.body.innerText.slice(0, 1200)");
      assert.fail(`${context}: expected ${text}. Body starts: ${body}`);
    }

    await navigate("/rate-calculator");
    await waitForText("Compare courier rates instantly.", "rate page hero");
    await evalJs(String.raw`
(async () => {
  const setValue = (el, value) => {
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value").set;
    setter.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  };
  setValue(document.querySelector('input[placeholder="Origin pincode"]'), '713513');
  setValue(document.querySelector('input[placeholder="Destination pincode"]'), '700001');
  setValue(document.querySelector('input[placeholder="Weight (kg)"]'), '1.2');
  setValue(document.querySelector('input[placeholder="Length (cm)"]'), '28');
  setValue(document.querySelector('input[placeholder="Breadth (cm)"]'), '22');
  setValue(document.querySelector('input[placeholder="Height (cm)"]'), '16');
  await new Promise((resolve) => setTimeout(resolve, 80));
  [...document.querySelectorAll('button')].find((button) => button.innerText.includes('Calculate rates')).click();
  return true;
})()
`, true);
    await waitForText("Intlexpress Priority", "rate results");
    await waitForText("Billable 1.97 kg", "rate billable weight");
    await waitForText("Regional", "rate zone");
    await evalJs(String.raw`
(async () => {
  const input = document.querySelector('input[placeholder="Origin pincode"]');
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), "value").set;
  setter.call(input, '123');
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 80));
  [...document.querySelectorAll('button')].find((button) => button.innerText.includes('Calculate rates')).click();
  return true;
})()
`, true);
    await waitForText("Enter valid pin codes", "rate validation error");

    await navigate("/weight-calculator");
    await waitForText("Calculate billable parcel weight.", "weight page hero");
    await waitForText("2.76 kg", "initial volumetric weight");
    await evalJs(String.raw`
(async () => {
  const inputs = [...document.querySelectorAll('.weight-controls input')].filter((input) => input.type !== 'range');
  const values = ['50', '40', '30', '10'];
  inputs.forEach((input, index) => {
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), "value").set;
    setter.call(input, values[index]);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  return true;
})()
`, true);
    await waitForText("12.00 kg", "updated volumetric and billable weight");
    await waitForText("Volumetric weight is higher", "oversize warning");

    await navigate("/tracking");
    await waitForText("IXP78254019 - IX-11892", "default tracking result");
    await waitForText("Out for delivery", "default tracking status");
    await evalJs(String.raw`
(async () => {
  [...document.querySelectorAll('.MuiChip-root')].find((chip) => chip.innerText.includes('IXP11984027')).click();
  return true;
})()
`, true);
    await waitForText("IXP11984027 - IX-10478", "second tracking result");
    await waitForText("Delivered", "second tracking status");
    await evalJs(String.raw`
(async () => {
  const input = document.querySelector('.calculator-form input');
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), "value").set;
  setter.call(input, 'BAD123');
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 80));
  [...document.querySelectorAll('button')].find((button) => button.innerText.includes('Track shipment')).click();
  return true;
})()
`, true);
    await waitForText("Tracking ID not found", "tracking validation error");

    passed = true;
  } finally {
    cdp?.close();
    chrome.kill("SIGKILL");
    await delay(800);

    try {
      const resolved = path.resolve(userDataDir);
      const temp = path.resolve(os.tmpdir());

      if (resolved.startsWith(temp) && path.basename(resolved).startsWith("intlexpress-cdp-")) {
        await rm(resolved, { recursive: true, force: true, maxRetries: 3, retryDelay: 250 });
      }
    } catch (cleanupError) {
      if (!passed) throw cleanupError;
      console.warn(`cleanup warning: ${cleanupError.message}`);
    }

    if (devServerProcess) devServerProcess.kill("SIGTERM");
  }
}

await runFunctionalSmokeTests();
await runBrowserSmokeTests();

console.log("smoke tests passed");
