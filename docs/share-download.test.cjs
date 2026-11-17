"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { TextEncoder, TextDecoder } = require("node:util");

const app = fs.readFileSync(path.join(__dirname, "../share/app.js"), "utf8");
const cid = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";

function loadPage(pageURL) {
  const url = new URL(pageURL);
  const elements = new Map();
  const outbound = [];
  const fetchCalls = [];
  const location = {
    hostname: url.hostname,
    origin: url.origin,
    pathname: url.pathname,
    search: url.search,
    hash: url.hash,
    assign(destination) { this.assigned = destination; },
  };

  function element(tag = "div") {
    return {
      tag, textContent: "", value: "", hidden: false, disabled: false,
      dataset: {}, style: {}, children: [], events: {},
      classList: { add() {}, remove() {} },
      addEventListener(event, handler) { this.events[event] = handler; },
      appendChild(child) { this.children.push(child); return child; },
      append(...children) { this.children.push(...children); },
      replaceChildren() { this.children = []; },
      setAttribute() {},
      remove() {},
      click() {
        if (this.tag === "a" && this.href) outbound.push(this.href);
        this.events.click?.();
      },
    };
  }

  function get(selector) {
    if (!elements.has(selector)) elements.set(selector, element());
    return elements.get(selector);
  }

  const gatewayOrigin = "https://ipfs.io";
  const gateways = {
    gatewayHostname: (origin) => new URL(origin).hostname,
    gatewayLabel: () => "IPFS.io",
    gatewayURL: (origin, name) => origin + "/ipfs/" + encodeURIComponent(name),
    loadGatewayOrigins: async () => [gatewayOrigin],
  };
  const document = {
    documentElement: { dataset: {} },
    body: element("body"),
    querySelector: get,
    createElement: element,
  };
  const browser = {
    ThirteenXGateways: gateways,
    matchMedia: () => ({ matches: false }),
    setTimeout,
  };
  const context = {
    window: browser, document, location, URL, URLSearchParams,
    TextEncoder, TextDecoder, Uint8Array,
    atob: (value) => Buffer.from(value, "base64").toString("binary"),
    btoa: (value) => Buffer.from(value, "binary").toString("base64"),
    AbortController, setTimeout, clearTimeout,
    performance: { now: () => 1 },
    localStorage: { getItem: () => null, setItem() {} },
    navigator: { clipboard: { writeText: async () => {} } },
    fetch: async (...args) => {
      fetchCalls.push(args);
      throw new Error("CORS unavailable");
    },
    console,
  };
  vm.runInNewContext(app, context, { filename: "share/app.js" });
  return { get, location, outbound, fetchCalls };
}

function descriptorURL(visibility = "public") {
  const descriptor = {
    v: 1, name: "My Ported Build.zip", cid, size: 5_000_000_000,
    mime: "application/zip", visibility,
  };
  return "https://share.13xfile.app/#" +
    Buffer.from(JSON.stringify(descriptor)).toString("base64url");
}

test("large file uses a direct gateway download even when CORS probes fail", async () => {
  const page = loadPage(descriptorURL());
  await new Promise(setImmediate);

  assert.equal(page.get("#file-name").textContent, "My Ported Build.zip");
  assert.equal(page.get("#download-button").disabled, false);
  page.get("#download-button").click();

  assert.equal(page.outbound.length, 1);
  const target = new URL(page.outbound[0]);
  assert.equal(target.hostname, "ipfs.io");
  assert.equal(target.pathname, "/ipfs/" + cid);
  assert.equal(target.searchParams.get("download"), "true");
  assert.equal(target.searchParams.get("filename"), "My Ported Build.zip");
  assert.ok(page.fetchCalls.every(([, opts]) => opts.headers.Range === "bytes=0-0"));
});

test("CID-only download URLs work without a desktop descriptor", async () => {
  const page = loadPage("https://share.13xfile.app/?cid=" + cid + "&name=Example.zip");
  await new Promise(setImmediate);
  assert.equal(page.get("#file-name").textContent, "Example.zip");
  assert.equal(page.get("#share-card").hidden, false);
});

test("share root offers CID entry", () => {
  const page = loadPage("https://share.13xfile.app/");
  assert.equal(page.get("#error-card").hidden, false);
  assert.equal(page.get("#error-title").textContent, "Open a public file");
  page.get("#open-file-input").value = cid;
  page.get("#open-file-form").events.submit({ preventDefault() {} });
  assert.equal(page.location.assigned, "/?cid=" + cid);
});

test("encrypted descriptor is refused in public browser", () => {
  const page = loadPage(descriptorURL("private"));
  assert.equal(page.get("#error-card").hidden, false);
  assert.match(page.get("#error-message").textContent, /Encrypted browser sharing is not enabled/);
  assert.equal(page.outbound.length, 0);
});
