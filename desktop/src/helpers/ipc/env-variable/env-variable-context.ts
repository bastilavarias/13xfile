require("dotenv").config();

export function exposeEnvContext() {
  const { contextBridge } = window.require("electron");
  contextBridge.exposeInMainWorld("envVariable", {
    apiBaseUrl: process.env.API_BASE_URL || "http://localhost:3333",
    webBaseUrl: process.env.WEB_BASE_URL || "http://localhost:3000",
  });
}
