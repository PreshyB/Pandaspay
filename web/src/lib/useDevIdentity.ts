import { useAccount } from './account';

/**
 * Kept so existing pages keep their shape, but identity now comes from the signed-in account.
 * 'seller' only yields a user once an admin has approved their seller application.
 */
export function useDevIdentity(role: 'buyer' | 'seller') {
  const { user, loading, isSeller } = useAccount();
  return { user: role === 'seller' && !isSeller ? null : user, loading };
}
