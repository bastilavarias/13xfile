import { exposeThemeContext } from "./theme/theme-context";
import { exposeWindowContext } from "./window/window-context";
import { exposeIPFSContext } from "./ipfs/ipfs-context";

export default function exposeContexts() {
  exposeWindowContext();
  exposeThemeContext();
  exposeIPFSContext();
}
