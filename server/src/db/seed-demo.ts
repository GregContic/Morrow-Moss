
import { eq, and } from 'drizzle-orm';
import { db } from './client.js';
import { shops, products } from './schema.js';

const demoShopDomain = 'morrow-moss-demo.myshopify.com';

const demoProducts = [
  {
    shopifyProductId: 'demo-1',
    title: 'Monstera Deliciosa',
    sku: 'PLT-MON-001',
    available: 8,
    dailySales: '4.00',
    leadTimeDays: 5,
    unitCost: '28.00',
  },
  {
    shopifyProductId: 'demo-2',
    title: 'Peace Lily',
    sku: 'PLT-PEA-004',
    available: 5,
    dailySales: '3.00',
    leadTimeDays: 7,
    unitCost: '18.00',
  },
  {
    shopifyProductId: 'demo-3',
    title: 'Snake Plant',
    sku: 'PLT-SNA-002',
    available: 30,
    dailySales: '2.00',
    leadTimeDays: 4,
    unitCost: '16.00',
  },
  {
    shopifyProductId: 'demo-4',
    title: 'Ceramic Planter — Sand',
    sku: 'POT-CER-008',
    available: 12,
    dailySales: '1.20',
    leadTimeDays: 10,
    unitCost: '14.00',
  },
  {
    shopifyProductId: 'demo-5',
    title: 'Botanical Care Kit',
    sku: 'KIT-BOT-003',
    available: 42,
    dailySales: '1.50',
    leadTimeDays: 6,
    unitCost: '12.00',
  },
];

async function seedDemo() {
  let [shop] = await db
    .select()
    .from(shops)
    .where(eq(shops.shopDomain, demoShopDomain))
    .limit(1);

  if (!shop) {
    await db.insert(shops).values({
      shopDomain: demoShopDomain,
      scope: 'demo',
    });

    [shop] = await db
      .select()
      .from(shops)
      .where(eq(shops.shopDomain, demoShopDomain))
      .limit(1);
  }

  if (!shop) {
    throw new Error('Could not create demo shop');
  }

  for (const product of demoProducts) {
    const [existing] = await db
      .select()
      .from(products)
      .where(
        and(
          eq(products.shopId, shop.id),
          eq(products.shopifyProductId, product.shopifyProductId),
        ),
      )
      .limit(1);

    if (!existing) {
      await db.insert(products).values({
        shopId: shop.id,
        ...product,
      });
    }
  }

  console.log('Demo shop and products are ready.');
  await db.$client.end();
}

seedDemo().catch(async (error) => {
  console.error('Demo seed failed:', error);
  await db.$client.end();
  process.exit(1);
});
