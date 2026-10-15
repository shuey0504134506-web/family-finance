/* eslint-disable @typescript-eslint/no-unused-vars -- חתימות התחליפים משקפות במכוון את חתימות Firebase, כולל פרמטרים שאינם בשימוש */
import { functionsBackend } from './functionsBackend';
export const getFunctions = (..._args: unknown[]): object => ({});
export const httpsCallable = <I, O>(_f: object, name: string) => async (data?: I): Promise<{ data: O }> => ({ data: (await functionsBackend.call(name, data)) as O });
