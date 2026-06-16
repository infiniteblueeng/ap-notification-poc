import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { Toast } from 'hooks/useToasts';

async function fetchEverbridgeTokenWithCreds() {
  const encodedParams = new URLSearchParams();
  encodedParams.set('grant_type', 'password');
  encodedParams.set('client_id', process.env.REACT_APP_EVERBRIDGE_CLIENT_ID);
  encodedParams.set('client_secret', process.env.REACT_APP_EVERBRIDGE_CLIENT_SECRET);
  encodedParams.set('username', process.env.REACT_APP_EVERBRIDGE_USERNAME);
  encodedParams.set('password', process.env.REACT_APP_EVERBRIDGE_PASSWORD);
  encodedParams.set('roleId', process.env.REACT_APP_EVERBRIDGE_ROLE_ID);
  encodedParams.set('scope', 'openid user-profile role');

  const resp = await fetch('https://api.everbridge.net/authorization/v1/tokens', {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' },
    body: encodedParams,
  });

  const json = await resp.json().catch(() => null);
  if (!resp.ok) throw json ?? new Error(`Token request failed (${resp.status})`);
  if (!json?.id_token) throw new Error('Token response missing id_token');
  return json;
}

/**
 * Production path: call the platform custom method.
 * Expected: it returns either a JSON object with id_token OR a JSON string.
 * If it returns {code,message,results}, we also handle results being a JSON string.
 */
async function fetchEverbridgeTokenViaPlatform(): Promise<any> {
  const fn = (globalThis as any)?.rbf_invokeCustomMethod;
  if (typeof fn !== 'function') {
    throw new Error('rbf_invokeCustomMethod is not available (not logged into the platform?)');
  }

  return await new Promise((resolve, reject) => {
    try {
      fn('eb_token', 'POST', null, null, JSON.stringify({}), {
        callback: function (res: any) {
          try {
            const outer = typeof res === 'string' ? JSON.parse(res) : res;

            let payload: any = outer;
            if (outer && typeof outer === 'object' && 'results' in outer) {
              payload = typeof (outer as any).results === 'string' ? JSON.parse((outer as any).results) : (outer as any).results;
            }

            if (!payload?.id_token) throw new Error('Token response missing id_token');
            resolve(payload);
          } catch (e) {
            reject(e);
          }
        },
        errorCallback: function (err: any) {
          reject(err);
        },
      });
    } catch (e) {
      reject(e);
    }
  });
}

type Params = {
  pushToast?: (t: Omit<Toast, 'id'>) => string;
  isDev: boolean; // caller decides (e.g., localhost/dev build => true; platform/prod => false)
  enabled?: boolean;
};

export function useEverbridgeToken({ pushToast, isDev, enabled = true }: Params): UseQueryResult<any> {
  return useQuery({
    queryKey: ['everbridgeToken', isDev ? 'dev' : 'prod'],
    queryFn: () => (isDev ? fetchEverbridgeTokenWithCreds() : fetchEverbridgeTokenViaPlatform()),
    enabled,
    staleTime: 55 * 60 * 1000,
    gcTime: 2 * 60 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}
