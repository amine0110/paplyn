import { createRequire } from "node:module";
import path from "node:path";
import type * as YjsTypes from "yjs";

const require = createRequire(import.meta.url);

/**
 * Explicit CJS bundle — same file y-websocket loads via `require('yjs')`.
 * Do not `import from "yjs"` in collab server code; that resolves to yjs.mjs (ESM).
 */
export const YJS_CJS_PATH = path.join(
  path.dirname(require.resolve("yjs/package.json")),
  "dist/yjs.cjs"
);

const Y = require(YJS_CJS_PATH) as typeof YjsTypes;

export default Y;

export type Doc = YjsTypes.Doc;
export type Text = YjsTypes.Text;
