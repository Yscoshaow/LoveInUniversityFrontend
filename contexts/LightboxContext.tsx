import { createContext, useContext } from 'react';

interface LightboxContextType {
  register: (closeFn: () => void) => void;
  unregister: () => void;
}

const LightboxContext = createContext<LightboxContextType | null>(null);

export const LightboxProvider = LightboxContext.Provider;

export function useLightboxRegister() {
  return useContext(LightboxContext);
}
