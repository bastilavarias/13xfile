import { exposeThemeContext } from "./theme/theme-context";
import { exposeWindowContext } from "./window/window-context";
import { exposeIPFSContext } from "./ipfs/ipfs-context";
import { exposeFileContext } from "./file/file-context";

export default function exposeContexts() {
  exposeWindowContext();
  exposeThemeContext();
  exposeIPFSContext();
  exposeFileContext();
}
