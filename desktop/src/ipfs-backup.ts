import { spawn } from "child_process";
import path from "path";
import { app } from "electron";

let ipfsProcess: any = null;
let fsInstance: any = null;

export function startIpfs() {
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
  } catch (error) {}
}

export async function uploadFile(file: ArrayBuffer): Promise<string | null> {
  try {
    const fileBuffer = new Uint8Array(file);
    const cid = await fsInstance.addBytes(fileBuffer);

    return cid.toString();
  } catch (error) {
    return null;
  }
}

export async function checkFileStatus(cid: string): Promise<boolean> {
  try {
    const stream = fsInstance.cat(cid);
    const firstChunk = await stream.next();

    return !firstChunk.done;
  } catch (error) {
    return false;
  }
}

// Stop IPFS Daemon
export function stopIpfs() {
  if (ipfsProcess) {
    ipfsProcess.kill();
    ipfsProcess = null;
  }
}
