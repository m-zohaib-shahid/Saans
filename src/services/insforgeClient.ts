import { createClient } from '@insforge/sdk';

const insforgeUrl = import.meta.env.VITE_INSFORGE_URL?.trim() || '';
const insforgeAnonKey = import.meta.env.VITE_INSFORGE_ANON_KEY?.trim() || '';

export function isInsForgeConfigured(): boolean {
  return Boolean(insforgeUrl && insforgeAnonKey);
}

export const insforge = createClient({
  baseUrl: insforgeUrl || 'https://n65whsxn.us-east.insforge.app',
  anonKey: insforgeAnonKey || undefined,
});
