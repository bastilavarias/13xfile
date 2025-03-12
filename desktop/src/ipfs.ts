import { spawn, execFile } from "child_process";
import path from "path";
import { app } from "electron";
import { promisify } from "util";
import fs from "fs";

const execPromise = promisify(execFile);

let ipfsProcess: any = null;
let ipfsClient: any = null;

const binaryPath = path.join(
  app.getAppPath(),
  "src/bin/ipfs/windows",
  process.platform === "win32" ? "ipfs.exe" : "ipfs",
);
const ipfsRepoPath = path.join(app.getPath("documents"), "ipfs-repo");
const env = { ...process.env, IPFS_PATH: ipfsRepoPath };

async function getPublicIP() {
  try {
    const response = await fetch("https://api64.ipify.org?format=json");
    const data = await response.json();
    return data.ip;
  } catch (error) {
    console.error("Failed to fetch public IP:", error);
    return null;
  }
}

async function openFirewallPort(port) {
  const command = [
    "New-NetFirewallRule",
    `-DisplayName 'Allow IPFS WebSocket ${port}'`,
    "-Direction Inbound",
    "-Protocol TCP",
    `-LocalPort ${port}`,
    "-Action Allow",
  ].join(" ");

  try {
    await execPromise(`powershell -Command "${command}"`);
    console.log(`✅ Successfully opened port ${port} in Windows Firewall.`);
  } catch (error) {
    console.error(`❌ Error opening port ${port}:`, error);
  }
}

async function enableRepository() {
  try {
    await fs.promises.access(ipfsRepoPath);
    await execPromise(binaryPath, ["config", "show"], { env });
  } catch (error) {
    try {
      await fs.promises.rm(ipfsRepoPath, { recursive: true, force: true });
      await execPromise(binaryPath, ["init"], { env });
    } catch (initError) {}
  }
}

async function exposePublicNetwork() {
  const env = { ...process.env, IPFS_PATH: ipfsRepoPath };
  const publicIp = await getPublicIP();
  if (!publicIp) {
    console.error("Public IP could not be determined.");
    return;
  }

  try {
    // Enable AutoNAT & AutoRelay
    await execPromise(
      binaryPath,
      ["config", "--json", "Swarm.EnableAutoNATService", "true"],
      { env },
    );
    console.log("AutoNAT service enabled successfully");

    await execPromise(
      binaryPath,
      ["config", "--json", "Swarm.EnableAutoRelay", "true"],
      { env },
    );
    console.log("AutoRelay enabled successfully");

    // Set DHT mode to client
    await execPromise(
      binaryPath,
      ["config", "--json", "Routing.Type", '"dhtclient"'],
      { env },
    );
    console.log("DHT client mode enabled");

    // Adjust Swarm connection manager settings
    await execPromise(
      binaryPath,
      ["config", "--json", "Swarm.ConnMgr.LowWater", "100"],
      { env },
    );
    await execPromise(
      binaryPath,
      ["config", "--json", "Swarm.ConnMgr.HighWater", "400"],
      { env },
    );
    await execPromise(
      binaryPath,
      ["config", "--json", "Swarm.ConnMgr.GracePeriod", '"1m"'],
      { env },
    );
    console.log("Swarm connection manager updated");

    // Set Addresses.Announce to include WebSocket (4002/ws)
    await execPromise(
      binaryPath,
      [
        "config",
        "--json",
        "Addresses.Announce",
        JSON.stringify([
          `/ip4/${publicIp}/tcp/4001`, // TCP transport
          `/ip4/${publicIp}/udp/4001/quic`, // QUIC transport
          `/ip4/${publicIp}/tcp/4002/ws`, // WebSocket transport
        ]),
      ],
      { env },
    );
    console.log("Public IP announced");

    // Ensure WebSockets are in Swarm Listen Addresses
    await execPromise(
      binaryPath,
      [
        "config",
        "--json",
        "Addresses.Swarm",
        JSON.stringify([
          `/ip4/0.0.0.0/tcp/4001`, // TCP transport
          `/ip4/0.0.0.0/udp/4001/quic`, // QUIC transport
          `/ip4/0.0.0.0/tcp/4002/ws`, // WebSocket transport
        ]),
      ],
      { env },
    );
    console.log("Swarm addresses updated to listen on WebSockets");

    // await openFirewallPort(4002);

    console.log(
      "✅ IPFS is now properly configured for public network access.",
    );
  } catch (error) {
    console.error("❌ Error configuring IPFS for public network:", error);
  }
}

async function waitForDaemon() {
  return new Promise<void>((resolve) => {
    const checkInterval = setInterval(async () => {
      try {
        if (!ipfsProcess) {
          return;
        }
        const { stdout } = await execPromise(binaryPath, ["id"], { env });
        console.log(stdout);
        clearInterval(checkInterval);
        resolve();
      } catch (error) {
        console.log("Waiting for IPFS daemon to start...", error);
      }
    }, 500);
  });
}

async function startDaemon() {
  try {
    ipfsProcess = spawn(binaryPath, ["daemon"], { stdio: "inherit", env });
    ipfsProcess.on("error", (err: any) => {
      console.error("Failed to start IPFS:", err);
    });
    ipfsProcess.on("exit", (code: any) => {
      console.log("IPFS stopped with exit code:", code);
    });
    await waitForDaemon();
    const kuboModule = await import("kubo-rpc-client");
    ipfsClient = kuboModule.create({ url: "http://127.0.0.1:5001/api/v0" });
  } catch (error) {
    console.error("Error starting IPFS daemon:", error);
  }
}

export async function bootIPFS() {
  enableRepository().then(() => {
    exposePublicNetwork().then(() => {
      startDaemon().then(async () => {});
    });
  });
}

export function getInstance() {
  return !!ipfsClient && !!ipfsClient;
}

export async function uploadFile(file: ArrayBuffer): Promise<string | null> {
  if (!ipfsClient) {
    console.error("IPFS client not initialized");
    return null;
  }

  try {
    const fileBuffer = Buffer.from(file);
    const result = await ipfsClient.add(fileBuffer);
    const cid = result.cid.toString();

    await execPromise(binaryPath, ["routing", "provide", cid]);
    console.log("📢 CID announced to the network!");

    await execPromise(binaryPath, ["pin", "add", cid]);
    console.log("📢 CID pinned to the node!");

    return cid;
  } catch (error) {
    console.error("Error uploading file:", error);
    return null;
  }
}

export async function checkFileStatus(cid: string): Promise<boolean> {
  if (!ipfsClient) {
    console.error("IPFS client not initialized");
    return false;
  }

  try {
    for await (const chunk of ipfsClient.cat(cid)) {
      if (chunk) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error("Failed to retrieve file:", error);
    return false;
  }
}

// Stop IPFS Daemon
export function stopIpfs() {
  if (ipfsProcess) {
    ipfsProcess.kill();
    ipfsProcess = null;
    ipfsClient = null;
  }
}
