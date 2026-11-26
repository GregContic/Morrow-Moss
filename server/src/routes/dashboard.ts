
import { Router } from 'express';
import { db } from '../db/client.js';
import { shops, products, activityLogs } from '../db/schema.js';
import { eq, desc } from 'drizzle-orm';
import { scoreInventory } from '../services/scoring.js';

export const dashboardRouter = Router();

const DEMO_SHOP_DOMAIN = 'morrow-moss-demo.myshopify.com';

dashboardRouter.get('/', async (req, res, next) => {
  try {
    const isDemo = process.env.MOCK_MODE !== 'false';

    const shopDomain = isDemo
      ? DEMO_SHOP_DOMAIN
      : String(req.shopDomain ?? '');

    if (!shopDomain) {
      return res.status(401).json({ error: 'Shop context required' });
    }

    const [shop] = await db
      .select()
      .from(shops)
      .where(eq(shops.shopDomain, shopDomain))
      .limit(1);

    if (!shop) {
      return res.status(404).json({ error: 'Shop not installed' });
    }

    const rows = await db
      .select()
      .from(products)
      .where(eq(products.shopId, shop.id));

    const ranked = rows
      .map((product) => {
        const dailySales = Number(product.dailySales);
        const unitCost = Number(product.unitCost);

        return {
          id: product.id,
          title: product.title,
          sku: product.sku,
          available: product.available,
          dailySales,
          leadTimeDays: product.leadTimeDays,
          unitCost,
          ...scoreInventory({
            available: product.available,
            dailySales,
            leadTimeDays: product.leadTimeDays,
          }),
        };
      })
      .sort((a, b) => b.priority - a.priority);

    const logs = await db
      .select()
      .from(activityLogs)
      .where(eq(activityLogs.shopId, shop.id))
      .orderBy(desc(activityLogs.createdAt))
      .limit(8);

    const critical = ranked.filter(
      (product) => product.status === 'Critical',
    ).length;

    const watch = ranked.filter(
      (product) => product.status === 'Watch',
    ).length;

    const healthy = ranked.filter(
      (product) => product.status === 'Healthy',
    ).length;

    const estimatedReorderValue = ranked
      .filter((product) => product.status !== 'Healthy')
      .reduce((total, product) => {
        const recommendedQuantity = Math.max(
          0,
          Math.ceil(
            product.dailySales * (product.leadTimeDays + 7) -
              product.available,
          ),
        );

        return total + recommendedQuantity * product.unitCost;
      }, 0);

    return res.json({
      products: ranked,
      summary: {
        totalProducts: ranked.length,
        critical,
        watch,
        healthy,
        estimatedReorderValue,
      },
      activity: logs,
    });
  } catch (error) {
    next(error);
  }
});
