import { spawn } from "child_process";
import path from "path";
import { app } from "electron";
// Change the import method for kubo-rpc-client

let ipfsProcess: any = null;
let ipfsClient: any = null;

// Start Kubo (IPFS Daemon)
export async function startIpfs() {
  try {
    const ipfsPath = path.join(
      app.getAppPath(),
      "src/bin/ipfs/windows",
      process.platform === "win32" ? "ipfs.exe" : "ipfs",
    );
    ipfsProcess = spawn(ipfsPath, ["daemon"], { stdio: "inherit" });

    ipfsProcess.on("error", (err: any) => {
      console.error("Failed to start IPFS:", err);
    });

    ipfsProcess.on("exit", (code: any) => {
      console.log("IPFS stopped with exit code:", code);
    });

    const kuboModule = await import("kubo-rpc-client");
    ipfsClient = kuboModule.create({ url: "http://127.0.0.1:5001/api/v0" });
  } catch (error) {
    console.error("Error starting IPFS daemon:", error);
  }
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
