import * as ReactJsx from 'react/jsx-runtime';
import { translateProps } from './translateProps';

export type { JSX } from 'react/jsx-runtime';
export const Fragment = ReactJsx.Fragment;

export const jsx: typeof ReactJsx.jsx = (type, props, key) =>
  ReactJsx.jsx(type, translateProps(type, props as Record<string, unknown>) as never, key);

export const jsxs: typeof ReactJsx.jsxs = (type, props, key) =>
  ReactJsx.jsxs(type, translateProps(type, props as Record<string, unknown>) as never, key);
