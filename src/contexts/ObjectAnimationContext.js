import { createContext, useContext } from 'react';

export const ObjectAnimationContext = createContext(null);

export function useObjectAnimationContext() {
  return useContext(ObjectAnimationContext);
}
