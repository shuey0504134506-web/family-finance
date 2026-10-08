import * as ReactDev from 'react/jsx-dev-runtime';
import { translateProps } from './translateProps';

export type { JSX } from 'react/jsx-dev-runtime';
export const Fragment = ReactDev.Fragment;

export const jsxDEV: typeof ReactDev.jsxDEV = (type, props, key, isStatic, source, self) =>
  ReactDev.jsxDEV(type, translateProps(type, props as Record<string, unknown>) as never, key, isStatic, source, self);
