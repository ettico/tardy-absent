import { useAuth } from '../context/AuthContext';
import { useInstitution } from '../context/InstitutionContext';

// Returns query params to attach to API calls so a SYSTEM_ADMIN operates on
// the institution they've selected. Secretary/principal accounts are scoped
// automatically server-side from their token, so this returns {} for them.
export function useScopeParams(): { institutionId?: string } {
  const { user } = useAuth();
  const { selectedInstitutionId } = useInstitution();
  if (user?.role === 'SYSTEM_ADMIN' && selectedInstitutionId) {
    return { institutionId: selectedInstitutionId };
  }
  return {};
}
