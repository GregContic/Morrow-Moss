
export type InventoryProduct = {
  id: number;
  title: string;
  sku: string;
  available: number;
  dailySales: number;
  leadTimeDays: number;
  unitCost?: number;
  priority: number;
  daysRemaining: number | null;
  status: 'Critical' | 'Watch' | 'Healthy';
};

export type ActivityItem = {
  id: number;
  action: string;
  detail: string;
  createdAt: string;
};

export type DashboardData = {
  products: InventoryProduct[];
  summary: {
    totalProducts: number;
    critical: number;
    watch: number;
    healthy: number;
    estimatedReorderValue: number;
  };
  activity: ActivityItem[];
};

export type RestockPlan = {
  id: number;
  productId: number;
  productTitle: string;
  sku: string;
  quantity: number;
  status: 'draft' | 'ordered' | 'received' | 'cancelled';
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RestockPlansData = {
  plans: RestockPlan[];
};

export async function getDashboard(): Promise<DashboardData> {
  const response = await authenticatedFetch('/api/dashboard');

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, 'Unable to load dashboard'));
  }

  return response.json();
}

export async function getRestockPlans(): Promise<RestockPlansData> {
  const response = await authenticatedFetch('/api/restock-plans');

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, 'Unable to load restock plans'));
  }

  return response.json();
}


export async function syncShopifyProducts(): Promise<{ ok: boolean; synced: number; message: string }> {
  const response = await authenticatedFetch('/api/sync/products', { method: 'POST' });
  if (!response.ok) {
    throw new Error(await getErrorMessage(response, 'Unable to synchronize Shopify products'));
  }
  return response.json();
}

export async function createRestockPlan(
  productId: number,
  quantity: number,
) {
  const response = await authenticatedFetch('/api/restock-plans', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ productId, quantity }),
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, 'Unable to create restock plan'));
  }

  return response.json();
}

export async function updateRestockPlan(
  id: number,
  updates: {
    status?: RestockPlan['status'];
    notes?: string;
  },
) {
  const response = await authenticatedFetch(`/api/restock-plans/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, 'Unable to update restock plan'));
  }

  return response.json();
}

async function getErrorMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const data = await response.json();
    return data.error || fallback;
  } catch {
    return fallback;
  }
}

declare global {
  interface Window {
    shopify?: {
      idToken?: () => Promise<string>;
    };
  }
}

let exchanged = false;

async function shopifyHeaders(): Promise<Record<string, string>> {
  if (import.meta.env.VITE_MOCK_MODE === 'true') {
    return {};
  }

  if (!window.shopify?.idToken) {
    throw new Error('Open StockPilot from Shopify Admin to authenticate.');
  }

  const idToken = await window.shopify.idToken();

  const payload = JSON.parse(
    atob(idToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')),
  );

  const shopDomain = new URL(payload.dest).hostname;

  if (!exchanged) {
    const exchange = await fetch('/api/auth/token-exchange', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ idToken }),
    });

    if (!exchange.ok) {
      throw new Error(
        'Shopify authentication failed. Check your app credentials and scopes.',
      );
    }

    exchanged = true;
  }

  return {
    Authorization: `Bearer ${idToken}`,
    'X-Shopify-Shop-Domain': shopDomain,
  };
}

export async function authenticatedFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const auth = await shopifyHeaders();

  return fetch(path, {
    ...init,
    headers: {
      ...auth,
      ...(init.headers as Record<string, string> ?? {}),
    },
  });
}
