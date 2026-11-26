
import { Router } from 'express';
import { z } from 'zod';
import { and, desc, eq } from 'drizzle-orm';

import { db } from '../db/client.js';
import {
  activityLogs,
  products,
  restockPlans,
  shops,
} from '../db/schema.js';

export const restockRouter = Router();

const DEMO_SHOP_DOMAIN = 'morrow-moss-demo.myshopify.com';

const createInput = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().positive().max(100000),
});

const updateInput = z
  .object({
    status: z.enum(['draft', 'ordered', 'received', 'cancelled']).optional(),
    notes: z.string().max(2000).optional(),
  })
  .refine(
    (value) => value.status !== undefined || value.notes !== undefined,
    { message: 'Provide a status or notes to update.' },
  );

async function getCurrentShop(req: any) {
  const isDemo = process.env.MOCK_MODE !== 'false';

  const domain = isDemo
    ? DEMO_SHOP_DOMAIN
    : String(req.shopDomain ?? '');

  if (!domain) {
    return null;
  }

  const [shop] = await db
    .select()
    .from(shops)
    .where(eq(shops.shopDomain, domain))
    .limit(1);

  return shop ?? null;
}

// GET /api/restock-plans
// Retrieve all saved restock plans for the current shop.
restockRouter.get('/', async (req, res, next) => {
  try {
    const shop = await getCurrentShop(req);

    if (!shop) {
      return res.status(404).json({ error: 'Shop not found' });
    }

    const plans = await db
      .select({
        id: restockPlans.id,
        productId: restockPlans.productId,
        productTitle: products.title,
        sku: products.sku,
        quantity: restockPlans.quantity,
        status: restockPlans.status,
        notes: restockPlans.notes,
        createdAt: restockPlans.createdAt,
        updatedAt: restockPlans.updatedAt,
      })
      .from(restockPlans)
      .innerJoin(
        products,
        eq(restockPlans.productId, products.id),
      )
      .where(eq(restockPlans.shopId, shop.id))
      .orderBy(desc(restockPlans.createdAt));

    return res.json({ plans });
  } catch (error) {
    next(error);
  }
});

// POST /api/restock-plans
// Create and persist a new restock plan.
restockRouter.post('/', async (req, res, next) => {
  try {
    const parsed = createInput.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid restock plan',
        details: parsed.error.flatten(),
      });
    }

    const shop = await getCurrentShop(req);

    if (!shop) {
      return res.status(404).json({ error: 'Shop not found' });
    }

    const [product] = await db
      .select()
      .from(products)
      .where(
        and(
          eq(products.id, parsed.data.productId),
          eq(products.shopId, shop.id),
        ),
      )
      .limit(1);

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const result = await db
      .insert(restockPlans)
      .values({
        shopId: shop.id,
        productId: product.id,
        quantity: parsed.data.quantity,
        status: 'draft',
      });

    const planId = Number(result[0].insertId);

    await db.insert(activityLogs).values({
      shopId: shop.id,
      actor: 'merchant',
      action: 'Restock plan created',
      detail: `Draft restock plan created for ${product.title}: ${parsed.data.quantity} units.`,
    });

    return res.status(201).json({
      ok: true,
      id: planId,
      mode: process.env.MOCK_MODE !== 'false' ? 'demo' : 'shopify',
      message: 'Restock plan successfully created.',
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/restock-plans/:id
// Update a saved plan and record the change.
restockRouter.patch('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ error: 'Invalid plan ID' });
    }

    const parsed = updateInput.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid update',
        details: parsed.error.flatten(),
      });
    }

    const shop = await getCurrentShop(req);

    if (!shop) {
      return res.status(404).json({ error: 'Shop not found' });
    }

    const [plan] = await db
      .select()
      .from(restockPlans)
      .where(
        and(
          eq(restockPlans.id, id),
          eq(restockPlans.shopId, shop.id),
        ),
      )
      .limit(1);

    if (!plan) {
      return res.status(404).json({
        error: 'Restock plan not found',
      });
    }

    await db
      .update(restockPlans)
      .set(parsed.data)
      .where(
        and(
          eq(restockPlans.id, id),
          eq(restockPlans.shopId, shop.id),
        ),
      );

    const changes = [];

    if (parsed.data.status !== undefined) {
      changes.push(`status changed to ${parsed.data.status}`);
    }

    if (parsed.data.notes !== undefined) {
      changes.push('notes updated');
    }

    await db.insert(activityLogs).values({
      shopId: shop.id,
      actor: 'merchant',
      action: 'Restock plan updated',
      detail: `Restock plan #${id}: ${changes.join(' and ')}.`,
    });

    return res.json({
      ok: true,
      id,
      message: 'Restock plan successfully updated.',
    });
  } catch (error) {
    next(error);
  }
});
