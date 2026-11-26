import { Router } from 'express';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { activityLogs, inventorySnapshots, products, shops } from '../db/schema.js';

export const syncRouter = Router();

type ShopifyProduct = {
  id: string;
  title: string;
  variants: { edges: { node: { sku: string | null; inventoryQuantity: number | null; price: string } }[] };
};

syncRouter.post('/products', async (req, res, next) => {
  try {
    const domain = String(req.shopDomain ?? '');
    if (!domain) return res.status(401).json({ error: 'Shop context required' });

    const [shop] = await db.select().from(shops).where(eq(shops.shopDomain, domain)).limit(1);
    if (!shop?.accessToken) return res.status(409).json({ error: 'Shop is not connected. Complete Shopify token exchange first.' });

    const apiVersion = process.env.SHOPIFY_API_VERSION || '2026-10';
    const query = `query StockPilotProducts { products(first: 100) { edges { node { id title variants(first: 100) { edges { node { sku inventoryQuantity price } } } } } } }`;
    const response = await fetch(`https://${domain}/admin/api/${apiVersion}/graphql.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': shop.accessToken },
      body: JSON.stringify({ query }),
    });
    const payload = await response.json() as {
      data?: { products?: { edges: { node: ShopifyProduct }[] } };
      errors?: { message: string }[];
    };
    if (!response.ok || payload.errors?.length) {
      return res.status(502).json({ error: 'Shopify product sync failed', detail: payload.errors?.map(e => e.message).join('; ') || response.statusText });
    }

    const nodes = payload.data?.products?.edges.map(edge => edge.node) ?? [];
    let synced = 0;
    for (const item of nodes) {
      const variantNodes = item.variants.edges.map(edge => edge.node);
      const available = variantNodes.reduce((sum, variant) => sum + (variant.inventoryQuantity ?? 0), 0);
      const sku = variantNodes.find(variant => variant.sku)?.sku || `SHOPIFY-${item.id.split('/').pop()}`;
      const shopifyProductId = item.id;
      const [existing] = await db.select().from(products)
        .where(and(eq(products.shopId, shop.id), eq(products.shopifyProductId, shopifyProductId))).limit(1);

      if (existing) {
        await db.update(products).set({ title: item.title, sku, available }).where(eq(products.id, existing.id));
        await db.insert(inventorySnapshots).values({ shopId: shop.id, productId: existing.id, available });
      } else {
        const inserted = await db.insert(products).values({
          shopId: shop.id, shopifyProductId, title: item.title, sku, available,
          dailySales: '0', leadTimeDays: 7, unitCost: '0',
        });
        const productId = Number(inserted[0].insertId);
        await db.insert(inventorySnapshots).values({ shopId: shop.id, productId, available });
      }
      synced += 1;
    }

    await db.insert(activityLogs).values({
      shopId: shop.id, actor: 'system', action: 'Shopify products synchronized',
      detail: `Synchronized ${synced} products and recorded inventory snapshots from Shopify.`,
    });
    return res.json({ ok: true, synced, message: `Synchronized ${synced} Shopify products.` });
  } catch (error) {
    next(error);
  }
});
