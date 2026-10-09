import * as R from "react/jsx-dev-runtime";
import { translateProps } from "./translate-props";

export const Fragment = R.Fragment;
export const jsxDEV: typeof R.jsxDEV = (type, props, key, isStatic, source, self) =>
  R.jsxDEV(type, translateProps(props), key, isStatic, source, self);
