import { spawn, execFile } from "child_process";
import { tmpdir } from "os";
import path from "path";
import { app } from "electron";
import { promisify } from "util";
import { existsSync, mkdirSync, promises as fsPromises, unlinkSync } from "fs";

require("dotenv").config();
const execPromise = promisify(execFile);

const BINARY_PATH = path.join(
  app.getAppPath(),
  "src/bin/ipfs/windows",
  process.platform === "win32" ? "ipfs.exe" : "ipfs",
);
const REPO_PATH = path.join(app.getPath("documents"), "ipfs-repo");
const ENV = { ...process.env, IPFS_PATH: REPO_PATH };
const DHT_IP = process.env.DHT_IP || "";
const DHT_PEER_ID = process.env.DHT_PEER_ID || "";
const DHT_MULTIADDR = `/ip4/${DHT_IP}/tcp/4001/p2p/${DHT_PEER_ID}`;

let ipfsProcess: ReturnType<typeof spawn> | null = null;

async function establishRepository() {
  if (!existsSync(REPO_PATH)) {
    mkdirSync(REPO_PATH, { recursive: true });
    await execPromise(BINARY_PATH, ["init"], { env: ENV });
  }

  const lockFile = path.join(REPO_PATH, "repo.lock");
  if (existsSync(lockFile)) {
    unlinkSync(lockFile);
  }
}

async function establishDaemon() {
  return new Promise<void>((resolve, reject) => {
    ipfsProcess = spawn(BINARY_PATH, ["daemon"], {
      stdio: "inherit",
      env: ENV,
    });
    ipfsProcess.on("error", (err) => {
      console.error("Failed to start IPFS:", err);
      reject(err);
    });
    ipfsProcess.on("exit", (code) => {
      console.log("IPFS stopped with exit code:", code);
      reject(new Error(`IPFS daemon exited with code ${code}`));
    });
    const checkInterval = setInterval(async () => {
      const { stdout } = await execPromise(BINARY_PATH, ["id"], { env: ENV });
      if (stdout.includes("ID")) {
        clearInterval(checkInterval);
        resolve();
      }
    }, 2000);
  });
}

async function establishDHTRelayConnection() {
  try {
    const { stdout } = await execPromise(BINARY_PATH, ["swarm", "peers"], {
      env: ENV,
    });
    if (stdout.includes(DHT_MULTIADDR)) {
      return;
    }
    await execPromise(BINARY_PATH, ["swarm", "connect", DHT_MULTIADDR], {
      env: ENV,
    });
  } catch (error) {
    console.error("Error connecting to custom relay:", error);
  }
}

// Main function to boot IPFS
export async function bootIPFS() {
  try {
    await establishRepository();
    await establishDaemon();
    await establishDHTRelayConnection();
  } catch (error) {
    console.error("Error booting IPFS:", error);
    throw error;
  }
}

export async function uploadFile(file: ArrayBuffer): Promise<string | null> {
  try {
    const tempDir = tmpdir();
    const tempFilePath = path.join(tempDir, "ipfs_upload");
    await fsPromises.writeFile(tempFilePath, Buffer.from(file));
    const { stdout } = await execPromise(
      BINARY_PATH,
      ["add", "-q", tempFilePath],
      { env: ENV },
    );
    const cid = stdout.trim();
    await execPromise(BINARY_PATH, ["routing", "provide", cid], { env: ENV });
    await execPromise(BINARY_PATH, ["pin", "add", cid], { env: ENV });

    await fsPromises.unlink(tempFilePath);

    return cid;
  } catch (error) {
    console.error("Error uploading file:", error);
    return null;
  }
}

export async function checkFileStatus(cid: string): Promise<boolean> {
  try {
    await execPromise(BINARY_PATH, ["files", "stat", `/ipfs/${cid}`], {
      env: ENV,
      maxBuffer: 1024,
    });
    return true;
  } catch (error) {
    console.error("Error checking file status:", error);
    return false;
  }
}

export function isRunning() {
  return !!ipfsProcess;
}

export function stopIpfs() {
  if (ipfsProcess) {
    ipfsProcess.kill();
    ipfsProcess = null;
  }
}

// @TODO: Separate the logics of upload, get, check functions may put it on helpers and use in services and put dht server congs in env andddd create lib folder and put this ipfs file on the lib.
