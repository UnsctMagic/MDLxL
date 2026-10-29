import { createContext, useContext } from 'react';

export const PreferencesContext = createContext({ preferences: undefined, openHotkeySettings: undefined });
export const usePreferencesContext = () => useContext(PreferencesContext);
