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

  try {
    await execPromise(
      binaryPath,
      ["config", "--json", "Swarm.EnableAutoNATService", "true"],
      { env },
    );
    console.log("AutoNAT service enabled successfully");

    // Enable AutoRelay
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

    // Allow public swarm connections
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

    const publicIp = "175.176.31.13"; //TODO: Make this dynamic
    await execPromise(
      binaryPath,
      [
        "config",
        "--json",
        "Addresses.Announce",
        JSON.stringify([
          `/ip4/${publicIp}/tcp/4001`,
          `/ip4/${publicIp}/udp/4001/quic`,
        ]),
      ],
      { env },
    );
    console.log("Public IP announced");

    console.log("IPFS configuration for public network completed.");
  } catch (error) {
    console.error("Error configuring IPFS for public network:", error);
  }
}

async function waitForDaemon() {
  return new Promise<void>((resolve) => {
    const checkInterval = setInterval(async () => {
      try {
        const { stdout } = await execPromise(binaryPath, ["id"], { env });
        console.log(stdout);
        clearInterval(checkInterval);
        resolve();
      } catch (err) {
        console.log("Waiting for IPFS daemon to start...", err);
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
    // const id = await ipfsClient.id();
    // console.log("Connected to Kubo!", id);
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
    if (ipfsClient.routing?.provide) {
      await ipfsClient.routing.provide(result.cid);
    }

    return result.cid.toString();
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
