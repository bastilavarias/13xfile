import { spawn, execFile } from "child_process";
import { tmpdir } from "os";
import path from "path";
import { app } from "electron";
import { promisify } from "util";
import { existsSync, mkdirSync, promises, unlinkSync } from "fs";

const execPromise = promisify(execFile);

let ipfsProcess: any = null;
let ipfsClient: any = null;

const binaryPath = path.join(
  app.getAppPath(),
  "src/bin/ipfs/windows",
  process.platform === "win32" ? "ipfs.exe" : "ipfs",
);
const repoPath = path.join(app.getPath("documents"), "ipfs-repo");
const env = { ...process.env, IPFS_PATH: repoPath };
const dhtIP = "";
const dhtPeerID = "";
const ownPeerAddress = `/ip4/${dhtIP}/tcp/4001/p2p/${dhtPeerID}`;

export async function bootIPFS() {
  await ensureIpfsRepo();
  await startDaemon();
  await waitForDaemon();
  await connectToCustomRelay();
  await checkIfConnectedToDHT(dhtPeerID);
  console.log("IPFS booted...");
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
  } catch (error) {
    console.error("Error starting IPFS daemon:", error);
  }
}

async function ensureIpfsRepo() {
  if (!existsSync(repoPath)) {
    mkdirSync(repoPath, { recursive: true });
    await execPromise(binaryPath, ["init"], { env });
  }

  const lockFile = path.join(repoPath, "repo.lock");
  if (existsSync(lockFile)) {
    console.log("Removing stale IPFS lock file...");
    unlinkSync(lockFile);
  }
}

async function waitForDaemon() {
  return new Promise<void>((resolve) => {
    const checkInterval = setInterval(async () => {
      try {
        const { stdout } = await execPromise(binaryPath, ["id"], { env });
        if (stdout.includes("ID")) {
          clearInterval(checkInterval);
          resolve();
        }
      } catch (error) {
        console.log("Waiting for IPFS daemon to start...");
      }
    }, 2000); // Check every 1 second
  });
}

async function connectToCustomRelay() {
  try {
    const output = await execPromise(binaryPath, ["swarm", "peers"], {
      env,
    });
    if (output.stdout.includes(ownPeerAddress)) {
      return;
    }

    await execPromise(binaryPath, ["swarm", "connect", ownPeerAddress], {
      env,
    });
    console.log("Connected to custom relay:", ownPeerAddress);
  } catch (error) {
    console.error("Error connecting to custom relay:", error);
  }
}

async function checkIfConnectedToDHT(dhtPeerID: string) {
  try {
    const { stdout } = await execPromise(binaryPath, ["swarm", "peers"], {
      env,
    });
    console.log("Connected to the DHT Server: ", stdout.includes(dhtPeerID));
  } catch (error) {
    console.error("Error checking connected peers:", error);
    return false;
  }
}

export function getInstance() {
  return !!ipfsClient && !!ipfsClient;
}

export async function uploadFile(file: ArrayBuffer): Promise<string | null> {
  try {
    const env = { ...process.env, IPFS_PATH: repoPath }; // Ensure custom repo path is used
    const fileBuffer = Buffer.from(file);
    const tempDir = tmpdir();
    const tempFilePath = path.join(tempDir, "ipfs_upload");
    await promises.writeFile(tempFilePath, fileBuffer);
    const { stdout } = await execPromise(
      binaryPath,
      ["add", "-q", tempFilePath],
      { env },
    );
    const cid = stdout.trim();

    await execPromise(binaryPath, ["routing", "provide", cid], { env });
    await execPromise(binaryPath, ["pin", "add", cid], { env });

    return cid;
  } catch (error) {
    console.error("Error uploading file:", error);
    return null;
  }
}

export async function checkFileStatus(cid: string): Promise<boolean> {
  try {
    return await new Promise((resolve, reject) => {
      const process = spawn(binaryPath, ["cat", cid], { env });
      let hasData = false;
      process.stdout.once("data", (chunk) => {
        hasData = true;
        resolve(true);
        process.kill();
      });
      process.stderr.once("data", (data) => {
        resolve(false); // File likely doesn't exist
      });
      process.on("error", (error) => {
        reject(error);
      });
      process.on("close", (code) => {
        if (!hasData) resolve(false);
      });
    });
  } catch (error) {
    console.error(error);
    return false;
  }
}

export function stopIpfs() {
  if (ipfsProcess) {
    ipfsProcess.kill();
    ipfsProcess = null;
    ipfsClient = null;
  }
}
