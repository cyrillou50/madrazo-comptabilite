import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { applyPalette, cacheAppearance, readCachedAppearance, resolvePalette, sanitizeAppearance, type Appearance, type Palette } from '../lib/appearance';
import { useAuth } from './AuthContext';

interface AppearanceValue {
  /** Apparence enregistrée pour l'organisation. */
  appearance: Appearance;
  /** Palette affichée : celle enregistrée, ou l'aperçu en cours dans les paramètres. */
  palette: Palette;
  preview: (appearance: Appearance) => void;
  cancelPreview: () => void;
}

const defaultPalette = resolvePalette(null);
const AppearanceContext = createContext<AppearanceValue | null>(null);

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const { user, preferences } = useAuth();
  const [cached] = useState(readCachedAppearance);
  const [previewing, setPreviewing] = useState<Appearance | null>(null);
  // Avant connexion, la dernière apparence vue sur cet appareil colore déjà la page de connexion.
  const appearance = useMemo(() => sanitizeAppearance(user ? preferences.appearance : cached), [user, preferences.appearance, cached]);
  const palette = useMemo(() => resolvePalette(previewing ?? appearance), [previewing, appearance]);

  useLayoutEffect(() => { applyPalette(palette); }, [palette]);
  useEffect(() => { if (user) cacheAppearance(appearance); }, [user, appearance]);

  const preview = useCallback((next: Appearance) => setPreviewing(next), []);
  const cancelPreview = useCallback(() => setPreviewing(null), []);
  const value = useMemo(() => ({ appearance, palette, preview, cancelPreview }), [appearance, palette, preview, cancelPreview]);
  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

// Ce hook partage volontairement le fichier du provider de contexte.
// eslint-disable-next-line react-refresh/only-export-components
export function useAppearance(): AppearanceValue {
  // Sans fournisseur (tests isolés), la palette d'origine s'applique.
  return useContext(AppearanceContext) ?? { appearance: sanitizeAppearance(null), palette: defaultPalette, preview: () => undefined, cancelPreview: () => undefined };
}
