export type InventoryProduct={id:number;title:string;sku:string;available:number;dailySales:number;leadTimeDays:number;priority:number;daysRemaining:number|null;status:'Critical'|'Watch'|'Healthy'};
export type DashboardData={products:InventoryProduct[];summary:{totalProducts:number;critical:number;watch:number;healthy:number;estimatedReorderValue:number};activity:{id:number;action:string;detail:string;createdAt:string}[]};
export async function getDashboard():Promise<DashboardData>{const response=await authenticatedFetch('/api/dashboard');if(!response.ok)throw new Error('Unable to load dashboard');return response.json();}
export async function createRestockPlan(productId:number,quantity:number){const response=await authenticatedFetch('/api/restock-plans',{ method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({productId,quantity})});if(!response.ok)throw new Error('Unable to create restock plan');return response.json();}

declare global { interface Window { shopify?: { idToken?: () => Promise<string> } } }
let exchanged = false;
async function shopifyHeaders(): Promise<Record<string,string>> {
  if (import.meta.env.VITE_MOCK_MODE === 'true') return {};
  if (!window.shopify?.idToken) throw new Error('Open StockPilot from Shopify Admin to authenticate.');
  const idToken = await window.shopify.idToken();
  const payload = JSON.parse(atob(idToken.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
  const shopDomain = new URL(payload.dest).hostname;
  if (!exchanged) {
    const exchange = await fetch('/api/auth/token-exchange',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken})});
    if (!exchange.ok) throw new Error('Shopify authentication failed. Check your app credentials and scopes.');
    exchanged = true;
  }
  return {'Authorization':`Bearer ${idToken}`,'X-Shopify-Shop-Domain':shopDomain};
}
export async function authenticatedFetch(path:string,init:RequestInit={}) {
  const auth = await shopifyHeaders();
  return fetch(path,{...init,headers:{...auth,...(init.headers as Record<string,string>??{})}});
}
