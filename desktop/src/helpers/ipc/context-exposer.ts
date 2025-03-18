import { exposeThemeContext } from "./theme/theme-context";
import { exposeWindowContext } from "./window/window-context";
import { exposeFileContext } from "./file/file-context";
import { exposeEnvContext } from "./env-variable/env-variable-context";

export default function exposeContexts() {
  exposeEnvContext();
  exposeWindowContext();
  exposeThemeContext();
  exposeFileContext();
}
