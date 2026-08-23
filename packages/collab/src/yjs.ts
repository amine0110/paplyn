import { createRequire } from "node:module";
import type * as YjsTypes from "yjs";

const require = createRequire(import.meta.url);

/**
 * Yjs from the same CJS module instance loaded by y-websocket/bin/utils.
 * Do not `import from "yjs"` in collab server code — ESM/CJS dual realms break
 * encode/apply on docs created by y-websocket (yjs#438).
 */
const Y = require("yjs") as typeof YjsTypes;

export default Y;

export type Doc = YjsTypes.Doc;
export type Text = YjsTypes.Text;
