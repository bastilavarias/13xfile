let heliaInstance: any = null;
let fsInstance: any = null;

export async function getHelia() {
  if (!heliaInstance) {
    const { createHelia } = await import("helia");
    const { unixfs } = await import("@helia/unixfs");
    heliaInstance = await createHelia();
    fsInstance = unixfs(heliaInstance);
  }

  return { helia: heliaInstance, fs: fsInstance };
}

export async function uploadFile(
  file: File,
  onProgress: (progress: number) => void,
): Promise<{ cid: string; filename: string } | null> {
  try {
    const { fs } = await getHelia();
    if (!fs) throw new Error("Helia filesystem (fs) is not initialized.");
    const fileBuffer = new Uint8Array(await file.arrayBuffer());
    let uploadedBytes = 0;
    const cid = await fs.addBytes(fileBuffer, {
      progress: (bytes: number) => {
        uploadedBytes += bytes;
        onProgress(uploadedBytes / fileBuffer.length); // Convert to percentage
      },
    });
    console.log("File uploaded, CID:", cid.toString());
    console.log(
      `Access it locally: http://127.0.0.1:8080/ipfs/${cid.toString()}`,
    );
    onProgress(1); // Mark as 100% complete
    return { cid: cid.toString(), filename: file.name }; // Return CID and filename
  } catch (error) {
    console.error("Error uploading file:", error);
    return null;
  }
}

export async function downloadFile(
  cid: string,
  filename: string,
): Promise<boolean> {
  try {
    const { fs: ipfsFs } = await getHelia();
    if (!ipfsFs) throw new Error("Helia filesystem (fs) is not initialized.");
    const chunks: Uint8Array[] = [];
    for await (const chunk of ipfsFs.cat(cid)) {
      chunks.push(chunk);
    }
    const fileBuffer = new Uint8Array(
      chunks.reduce((acc, val) => [...acc, ...val], []),
    );
    if (!window.electronWindow?.saveFile)
      throw new Error("Electron saveFile is not initialized.");

    window.electronWindow.saveFile({
      filename, // Use the original filename
      content: fileBuffer,
    });

    return true;
  } catch (error) {
    console.error("Error downloading file:", error);
    return false;
  }
}

/**
 * Checks if a file is available on Helia by attempting to retrieve a small chunk of data.
 * @param cid - The CID of the file to check.
 * @returns Boolean indicating whether the file is available.
 */
export async function isFileOnline(cid: string): Promise<boolean> {
  try {
    const { fs } = await getHelia();
    if (!fs) throw new Error("Helia filesystem (fs) is not initialized.");

    // Attempt to fetch a small portion of the file
    const iterator = fs.cat(cid);
    const { value } = await iterator.next();

    return !!value; // If a value is received, the file exists
  } catch (error) {
    console.warn(`File with CID ${cid} is not available.`, error);
    return false; // Return false if the file isn't found
  }
}
