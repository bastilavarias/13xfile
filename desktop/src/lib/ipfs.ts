require("dotenv").config();

import { spawn, execFile } from "child_process";
import { tmpdir } from "os";
import path from "path";
import { app } from "electron";
import { promisify } from "util";
import { existsSync, mkdirSync, promises as fsPromises, unlinkSync } from "fs";

const execPromise = promisify(execFile);

const BINARY_PATH = path.join(
  app.getAppPath(),
  "src/bin/ipfs/windows",
  process.platform === "win32" ? "ipfs.exe" : "ipfs",
);
const REPO_PATH = path.join(app.getPath("documents"), "ipfs-repo");
const ENV = { ...process.env, IPFS_PATH: REPO_PATH };
const devEnvironment = process.env.DEV_ENVIRONMENT || "development";
const DHT_IP = process.env.DHT_IP || "";
const DHT_PEER_ID = process.env.DHT_PEER_ID || "";
const DHT_MULTIADDR = `/ip4/${DHT_IP}/tcp/4005/p2p/${DHT_PEER_ID}`;

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

async function configureIpfs() {
  // Set of configuration commands to enable DHT and content advertising
  const configCommands = [
    // Enable DHT routing
    [BINARY_PATH, ["config", "--json", "Routing.Type", '"dht"'], { env: ENV }],
    // Set DHT mode to server (actively participates in the network)
    [
      BINARY_PATH,
      ["config", "--json", "Routing.Mode", '"server"'],
      { env: ENV },
    ],
    // Provide all content to the network
    [
      BINARY_PATH,
      ["config", "--json", "Reprovider.Strategy", '"all"'],
      { env: ENV },
    ],
    // Enable experimental features if needed
    [
      BINARY_PATH,
      ["config", "--json", "Experimental.FilestoreEnabled", "true"],
      { env: ENV },
    ],
    // Connect to default bootstrap nodes
    [BINARY_PATH, ["bootstrap", "add", "--default"], { env: ENV }],
  ];

  // Execute all configuration commands
  for (const [cmd, args, options] of configCommands) {
    try {
      const { stdout, stderr } = await execPromise(cmd, args, options);
      console.log(`Config command success: ${args.join(" ")}`);
      if (stdout) console.log(`Output: ${stdout}`);
      if (stderr) console.warn(`Warning: ${stderr}`);
    } catch (error) {
      console.error(`Failed to run config command ${args.join(" ")}:`, error);
      // Continue with other commands even if one fails
    }
  }
}

async function establishRelayConnection() {
  try {
    await execPromise(
      BINARY_PATH,
      ["config", "--json", "Swarm.Transports.Network.Relay", "true"],
      { env: ENV },
    );
    await execPromise(
      BINARY_PATH,
      ["config", "--json", "Swarm.RelayClient.Enabled", "true"],
      { env: ENV },
    );
    await execPromise(
      BINARY_PATH,
      ["config", "--json", "Swarm.RelayService.Enabled", "true"],
      { env: ENV },
    );
    await execPromise(
      BINARY_PATH,
      ["config", "--json", "Addresses.Swarm", JSON.stringify(["/p2p-circuit"])],
      { env: ENV },
    );
    await execPromise(BINARY_PATH, ["swarm", "connect", DHT_MULTIADDR], {
      env: ENV,
    });
    await execPromise(
      BINARY_PATH,
      [
        "swarm",
        "connect",
        "/ip4/192.168.1.48/tcp/4002/ws/p2p/QmVJomYR2E7CdRxbbAvMhkPehYrXxwcjh8Nnf5cCo9MyzP/p2p-circuit/p2p/QmbYkB7cV1R6XHWDrwZ91Rymroz6dNHhwXgQr14DNgoFRJ",
      ],
      { env: ENV },
    );
  } catch (error) {
    console.error("Error connecting to custom relay:", error);
  }
}

async function runCommandWithProgress(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  onProgress: (progress: number, message: string) => void,
  startProgress: number,
  endProgress: number,
  taskName: string,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { env });
    let output = "";
    child.stdout.on("data", (data) => {
      output += data.toString();
      const progress =
        startProgress + Math.floor((endProgress - startProgress) * 0.5); // Example: 50% of the task
      onProgress(progress, `${taskName} in progress...`);
    });
    child.stderr.on("data", (data) => {
      console.error(`stderr: ${data}`);
    });
    child.on("close", (code) => {
      if (code === 0) {
        onProgress(endProgress, `${taskName} complete.`);
        resolve();
      } else {
        reject(new Error(`${taskName} failed with code ${code}: ${output}`));
      }
    });
    child.on("error", (error) => {
      reject(error);
    });
  });
}

export async function bootIPFS() {
  try {
    await establishRepository();
    await establishDaemon();
    // await configureIpfs();
    await establishRelayConnection();
  } catch (error) {
    console.error("Error booting IPFS:", error);
    throw error;
  }
}

export async function uploadFile(
  file: ArrayBuffer,
  onProgress: (progress: number, progressMessage: string) => void,
): Promise<string | null> {
  try {
    const tempDir = tmpdir();
    const tempFilePath = path.join(tempDir, "ipfs_upload");
    await fsPromises.writeFile(tempFilePath, Buffer.from(file));
    onProgress(20, "Temporary file created...");
    const fileSize = file.byteLength;
    let uploadedSize = 0;
    const addProcess = spawn(BINARY_PATH, ["add", "-q", tempFilePath], {
      env: ENV,
    });
    addProcess.stdout.on("data", (data) => {
      uploadedSize += data.length;
      const progress = Math.round((uploadedSize / fileSize) * 100);
      onProgress(30 + Math.floor(progress * 0.4), `Uploading: ${progress}%`); // Scale progress between 30% and 70%
    });
    addProcess.stderr.on("data", (data) => {
      console.error(`stderr: ${data}`);
    });
    const stdout = await new Promise<string>((resolve, reject) => {
      let stdoutData = "";
      addProcess.stdout.on("data", (data) => {
        stdoutData += data.toString();
      });
      addProcess.on("close", (code) => {
        if (code === 0) {
          resolve(stdoutData.trim());
        } else {
          reject(new Error(`IPFS add process failed with code ${code}`));
        }
      });
      addProcess.on("error", (error) => {
        reject(error);
      });
    });
    onProgress(70, "File adding to the IPFS network...");
    const cid = stdout.trim();
    await runCommandWithProgress(
      BINARY_PATH,
      ["routing", "provide", cid],
      ENV,
      onProgress,
      70, // Start progress
      75, // End progress
      "Providing CID to the IPFS network...",
    );
    await runCommandWithProgress(
      BINARY_PATH,
      ["pin", "add", cid],
      ENV,
      onProgress,
      75,
      85,
      "Pinning file to IPFS...",
    );
    // if (devEnvironment !== "development") {
    //   await runCommandWithProgress(
    //     BINARY_PATH,
    //     ["pin", "add", cid],
    //     ENV,
    //     onProgress,
    //     75,
    //     85,
    //     "Pinning file to IPFS...",
    //   );
    // }
    await runCommandWithProgress(
      BINARY_PATH,
      ["pin", "add", cid],
      ENV,
      onProgress,
      75,
      85,
      "Pinning file to IPFS...",
    );
    await runCommandWithProgress(
      BINARY_PATH,
      ["pin", "add", cid],
      ENV,
      onProgress,
      75,
      85,
      "Pinning file to IPFS...",
    );
    await fsPromises.unlink(tempFilePath);
    onProgress(85, "Unlinking temporary file...");

    return cid;
  } catch (error) {
    console.error("Error uploading file:", error);
    onProgress(0, `Upload failed: Something went wrong.`);
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
