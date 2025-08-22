import React from 'react'
export const defaultSettings = {
  locationMode: (import.meta.env.VITE_LOCATION_MODE || 'random').toLowerCase(),
  country: import.meta.env.VITE_COUNTRY || '',
  includeOceans: String(import.meta.env.VITE_INCLUDE_OCEANS || 'false').toLowerCase() === 'true',
  lowQuotaMode: String(import.meta.env.VITE_LOW_QUOTA_MODE || 'false').toLowerCase() === 'true',
  svAttemptBudget: parseInt(import.meta.env.VITE_SV_ATTEMPT_BUDGET || '8', 10),
  svBaseBackoffMs: 2000, // Fixed regardless of preset now
  svMaxRadiusM: parseInt(import.meta.env.VITE_SV_MAX_RADIUS_M || '300000', 10),
  preset: 'custom',
}
export const SettingsContext = React.createContext({ settings: defaultSettings, setSettings: () => {} })
export function useSettings(){ return React.useContext(SettingsContext) }
