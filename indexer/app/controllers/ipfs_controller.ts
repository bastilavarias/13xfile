import type { HttpContext } from "@adonisjs/core/http";
import { getInstance } from "../../lib/ipfs.js";

export default class IPFSController {
  async download({ response, params }: HttpContext) {
    try {
      const { fs } = await getInstance();
      const chunks = [];
      for await (const chunk of fs.cat(params.cid)) {
        chunks.push(chunk);
      }
      const fileData = Buffer.concat(chunks);
      response.header(
        "Content-Disposition",
        `attachment; filename=${params.cid}`,
      );
      response.header("Content-Type", "application/octet-stream");

      response.json({
        data: fileData,
      });
    } catch (error) {
      console.error(error);
      return response.status(500).json({ error: error.message });
    }
  }
}
