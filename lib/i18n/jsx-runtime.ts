// Custom JSX runtime (configured in vite.config.ts): wraps React's runtime and
// translates static Arabic text in our own components when English is active.
import * as R from "react/jsx-runtime";
import { translateProps } from "./translate-props";

export const Fragment = R.Fragment;
export const jsx: typeof R.jsx = (type, props, key) => R.jsx(type, translateProps(props), key);
export const jsxs: typeof R.jsxs = (type, props, key) => R.jsxs(type, translateProps(props), key);
