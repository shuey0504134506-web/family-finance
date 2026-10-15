import { functionsBackend } from './functionsBackend';
export const getFunctions = (..._args: unknown[]): object => ({});
export const httpsCallable = <I, O>(_f: object, name: string) => async (data?: I): Promise<{ data: O }> => ({ data: (await functionsBackend.call(name, data)) as O });
