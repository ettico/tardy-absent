import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '../api/client';
import { useAuth } from './AuthContext';
import type { Institution } from '../types';

interface InstitutionContextValue {
  institutions: Institution[];
  selectedInstitutionId: string | null;
  setSelectedInstitutionId: (id: string) => void;
  refreshInstitutions: () => void;
}

const InstitutionContext = createContext<InstitutionContextValue | undefined>(undefined);

// Only relevant for SYSTEM_ADMIN, who is not tied to a single institution and
// needs to pick which one they're currently managing. Secretaries/principals
// are scoped server-side to their own institution automatically.
export function InstitutionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [selectedInstitutionId, setSelectedInstitutionIdState] = useState<string | null>(
    () => localStorage.getItem('selectedInstitutionId')
  );

  const refreshInstitutions = () => {
    if (user?.role !== 'SYSTEM_ADMIN') return;
    api.get<Institution[]>('/institutions').then((res) => {
      setInstitutions(res.data);
      if (!selectedInstitutionId && res.data.length > 0) {
        setSelectedInstitutionId(res.data[0].id);
      }
    });
  };

  useEffect(() => {
    refreshInstitutions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role]);

  const setSelectedInstitutionId = (id: string) => {
    localStorage.setItem('selectedInstitutionId', id);
    setSelectedInstitutionIdState(id);
  };

  const value = useMemo(
    () => ({ institutions, selectedInstitutionId, setSelectedInstitutionId, refreshInstitutions }),
    [institutions, selectedInstitutionId]
  );

  return <InstitutionContext.Provider value={value}>{children}</InstitutionContext.Provider>;
}

export function useInstitution(): InstitutionContextValue {
  const ctx = useContext(InstitutionContext);
  if (!ctx) throw new Error('useInstitution must be used within InstitutionProvider');
  return ctx;
}
