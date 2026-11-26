
import { useEffect, useMemo, useState } from 'react';
import {
  getDashboard,
  getRestockPlans,
  createRestockPlan,
  updateRestockPlan,
  syncShopifyProducts,
  type DashboardData,
  type InventoryProduct,
  type RestockPlan,
} from './lib/api';

type View = 'overview' | 'inventory' | 'restock' | 'activity' | 'settings';

const money = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value || 0);

const dateLabel = (value: string) =>
  new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

function App() {
  const [view, setView] = useState<View>('overview');
  const [data, setData] = useState<DashboardData | null>(null);
  const [plans, setPlans] = useState<RestockPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<InventoryProduct | null>(null);
  const [quantity, setQuantity] = useState(24);
  const [saving, setSaving] = useState(false);
  const [updatingPlan, setUpdatingPlan] = useState<number | null>(null);
  const [notice, setNotice] = useState('');
  const [syncing, setSyncing] = useState(false);

  async function refresh() {
    try {
      setError('');
      const [dashboard, restockData] = await Promise.all([
        getDashboard(),
        getRestockPlans(),
      ]);
      setData(dashboard);
      setPlans(restockData.plans);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load StockPilot data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const products = data?.products ?? [];

  const filteredProducts = useMemo(
    () =>
      products.filter((product) =>
        `${product.title} ${product.sku}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [products, query],
  );

  async function syncProducts() {
    try {
      setSyncing(true);
      setError('');
      const result = await syncShopifyProducts();
      setNotice(result.message);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to synchronize Shopify products.');
    } finally {
      setSyncing(false);
    }
  }

  async function savePlan() {
    if (!selectedProduct || quantity < 1) return;

    try {
      setSaving(true);
      setError('');
      await createRestockPlan(selectedProduct.id, quantity);
      setSelectedProduct(null);
      setQuantity(24);
      setNotice('Restock plan created successfully.');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create restock plan.');
    } finally {
      setSaving(false);
    }
  }

  async function changePlanStatus(plan: RestockPlan, status: RestockPlan['status']) {
    try {
      setUpdatingPlan(plan.id);
      setError('');
      await updateRestockPlan(plan.id, { status });
      setNotice(`Plan #${plan.id} updated to ${status}.`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update restock plan.');
    } finally {
      setUpdatingPlan(null);
    }
  }

  function openPlan(product: InventoryProduct) {
    setSelectedProduct(product);
    setQuantity(Math.max(1, Math.ceil(product.dailySales * product.leadTimeDays * 2)));
  }

  function navItem(label: string, target: View, icon: string) {
    return (
      <a
        href={`#${target}`}
        className={view === target ? 'active' : ''}
        onClick={(event) => {
          event.preventDefault();
          setView(target);
          setNotice('');
        }}
      >
        <span style={{ display: 'inline-block', width: 24 }}>{icon}</span>
        {label}
      </a>
    );
  }

  function statusBadge(status: InventoryProduct['status']) {
    return <span className={`status ${status.toLowerCase()}`}>{status}</span>;
  }

  function planStatusBadge(status: RestockPlan['status']) {
    const className =
      status === 'ordered' || status === 'received'
        ? 'healthy'
        : status === 'cancelled'
          ? 'critical'
          : 'watch';

    return <span className={`status ${className}`}>{status}</span>;
  }

  function renderInventoryTable() {
    return (
      <div className="table-card">
        <div className="table-toolbar">
          <div className="table-title">
            <b>Product inventory</b>
            <span className="count">{filteredProducts.length} products</span>
          </div>
          <div className="search">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search products..."
              aria-label="Search products"
            />
          </div>
          <button className="secondary" onClick={() => void refresh()}>
            Refresh
          </button>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>PRODUCT</th>
                <th>AVAILABLE</th>
                <th>DAILY SALES</th>
                <th>LEAD TIME</th>
                <th>DAYS LEFT</th>
                <th>PRIORITY</th>
                <th>STATUS</th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product, index) => (
                <tr key={product.id}>
                  <td>
                    <div className="product-cell">
                      <span className={`product-thumb thumb-${(index % 3) + 1}`}>
                        {index % 2 === 0 ? '🌿' : '🪴'}
                      </span>
                      <div>
                        <b>{product.title}</b>
                        <small>{product.sku}</small>
                      </div>
                    </div>
                  </td>
                  <td><b>{product.available}</b> units</td>
                  <td>{product.dailySales.toFixed(1)}</td>
                  <td>{product.leadTimeDays} days</td>
                  <td>
                    {product.daysRemaining === null
                      ? '—'
                      : `${product.daysRemaining.toFixed(1)} days`}
                  </td>
                  <td>
                    <div className="score">
                      <b>{product.priority}</b>
                      <span className="score-track">
                        <i style={{ width: `${Math.min(100, product.priority)}%` }} />
                      </span>
                    </div>
                  </td>
                  <td>{statusBadge(product.status)}</td>
                  <td>
                    <button className="row-action" onClick={() => openPlan(product)}>
                      + Restock
                    </button>
                  </td>
                </tr>
              ))}
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={8}>No products match your search.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="table-footer">
          Inventory risk is calculated using available stock, sales velocity, and supplier lead time.
          <span>{products.length} total products</span>
        </div>
      </div>
    );
  }

  function renderActivity() {
    const activity = data?.activity ?? [];

    return (
      <div className="panel">
        <div className="panel-head">
          <div>
            <h3>Activity history</h3>
            <p>A record of inventory and restock-plan changes.</p>
          </div>
          <button className="secondary" onClick={() => void refresh()}>Refresh</button>
        </div>
        <div className="activity-list">
          {activity.length > 0 ? (
            activity.map((item) => (
              <div className="activity-item" key={item.id}>
                <span className="activity-dot">✓</span>
                <div>
                  <b>{item.action}</b>
                  <p>{item.detail}</p>
                  <small>{dateLabel(item.createdAt)}</small>
                </div>
              </div>
            ))
          ) : (
            <p className="subhead">No activity recorded yet. Creating or updating a restock plan will appear here.</p>
          )}
        </div>
      </div>
    );
  }

  function renderRestockPlans() {
    return (
      <div className="table-card">
        <div className="table-toolbar">
          <div className="table-title">
            <b>Restock plans</b>
            <span className="count">{plans.length} plans</span>
          </div>
          <button className="secondary" onClick={() => void refresh()}>Refresh</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>PLAN</th>
                <th>PRODUCT</th>
                <th>QUANTITY</th>
                <th>CREATED</th>
                <th>STATUS</th>
                <th>UPDATE STATUS</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => (
                <tr key={plan.id}>
                  <td><b>#{plan.id}</b></td>
                  <td>
                    <b>{plan.productTitle}</b>
                    <small>{plan.sku}</small>
                  </td>
                  <td>{plan.quantity} units</td>
                  <td>{dateLabel(plan.createdAt)}</td>
                  <td>{planStatusBadge(plan.status)}</td>
                  <td>
                    <select
                      className="filter"
                      value={plan.status}
                      disabled={updatingPlan === plan.id}
                      onChange={(event) =>
                        void changePlanStatus(plan, event.target.value as RestockPlan['status'])
                      }
                      aria-label={`Update status for plan ${plan.id}`}
                    >
                      <option value="draft">Draft</option>
                      <option value="ordered">Ordered</option>
                      <option value="received">Received</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </td>
                </tr>
              ))}
              {plans.length === 0 && (
                <tr>
                  <td colSpan={6}>No restock plans yet. Create one from the inventory table.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="table-footer">
          Update a plan's status as it moves through your purchasing workflow.
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="loading">Loading StockPilot...</div>;
  }

  if (!data) {
    return (
      <div className="loading">
        <p>StockPilot couldn't load your dashboard.</p>
        <p>{error}</p>
        <button className="primary" onClick={() => { setLoading(true); void refresh(); }}>
          Try again
        </button>
      </div>
    );
  }

  const pageTitles: Record<View, string> = {
    overview: 'Overview',
    inventory: 'Inventory',
    restock: 'Restock plans',
    activity: 'Activity',
    settings: 'Settings',
  };

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">✳</span>
          <div>
            <b>stockpilot</b>
            <small>INVENTORY INTELLIGENCE</small>
          </div>
        </div>

        <div className="shop-switch">
          <span className="shop-avatar">M</span>
          <div>
            <b>Morrow &amp; Moss</b>
            <small>Development store</small>
          </div>
          <span>⌄</span>
        </div>

        <nav>
          <p className="nav-label">WORKSPACE</p>
          {navItem('Overview', 'overview', '⌂')}
          {navItem('Inventory', 'inventory', '▦')}
          {navItem('Restock plans', 'restock', '↗')}
          <p className="nav-label">MANAGE</p>
          {navItem('Activity', 'activity', '◷')}
          {navItem('Settings', 'settings', '⚙')}
        </nav>

        <div className="sidebar-bottom">
          <div className="help-card">
            <b>Need a hand?</b>
            <p>StockPilot helps you stay ahead of stockouts and make smarter purchasing decisions.</p>
            <a href="mailto:support@morrowandmoss.example">Contact support →</a>
          </div>
          <div className="profile">
            <span className="profile-avatar">MM</span>
            <div>
              <b>Store Admin</b>
              <small>Morrow &amp; Moss</small>
            </div>
            <span>•••</span>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <span className="breadcrumb">StockPilot</span>
            <span className="crumb-sep">/</span>
            <b>{pageTitles[view]}</b>
          </div>
          <div className="top-actions">
            <span className="demo-pill"><i /> DEMO MODE</span>
            <button className="avatar-btn" aria-label="Store profile">M</button>
          </div>
        </header>

        <div className="content">
          <div className="welcome">
            <div>
              <p className="eyebrow">MORROW &amp; MOSS / INVENTORY INTELLIGENCE</p>
              <h1>
                {view === 'overview' && <>Good day, <span>Admin.</span></>}
                {view !== 'overview' && <>{pageTitles[view]}<span>.</span></>}
              </h1>
              <p className="subhead">
                {view === 'overview' && 'Here’s what’s happening with your inventory today.'}
                {view === 'inventory' && 'Monitor stock levels and identify products that need attention.'}
                {view === 'restock' && 'Manage purchasing decisions from draft to received.'}
                {view === 'activity' && 'Review the latest actions recorded in your store.'}
                {view === 'settings' && 'Your current StockPilot environment and configuration.'}
              </p>
            </div>
            {view === 'inventory' && import.meta.env.VITE_MOCK_MODE !== 'true' && (
              <button className="secondary" disabled={syncing} onClick={() => void syncProducts()}>
                {syncing ? 'Syncing Shopify…' : '↻ Sync Shopify products'}
              </button>
            )}
            {view !== 'settings' && (
              <button className="primary" onClick={() => setSelectedProduct(products[0] ?? null)}>
                + Create restock plan
              </button>
            )}
          </div>

          {error && (
            <div className="notice">
              <span>!</span>
              <p>{error}</p>
              <button className="secondary" onClick={() => { setError(''); void refresh(); }}>Retry</button>
            </div>
          )}

          {notice && (
            <div className="notice">
              <span>✓</span>
              <p>{notice}</p>
              <button className="secondary" onClick={() => setNotice('')}>Dismiss</button>
            </div>
          )}

          {view === 'overview' && (
            <>
              <div className="notice">
                <span>✦</span>
                <p><b>Inventory insight:</b> StockPilot prioritizes products based on stock coverage, sales velocity, and supplier lead time.</p>
                <a href="#inventory" onClick={(event) => { event.preventDefault(); setView('inventory'); }}>View inventory →</a>
              </div>

              <div className="metrics">
                <div className="metric">
                  <div className="metric-top">Total products <i>▦</i></div>
                  <strong>{data.summary.totalProducts}</strong>
                  <small>Products being monitored</small>
                </div>
                <div className="metric">
                  <div className="metric-top">Critical stock <i className="red">!</i></div>
                  <strong>{data.summary.critical}</strong>
                  <small>Products needing urgent attention</small>
                </div>
                <div className="metric">
                  <div className="metric-top">Watch list <i className="amber">◷</i></div>
                  <strong>{data.summary.watch}</strong>
                  <small>Products to keep an eye on</small>
                </div>
                <div className="metric">
                  <div className="metric-top">Estimated reorder value <i>$</i></div>
                  <strong>{money(data.summary.estimatedReorderValue)}</strong>
                  <small>Based on suggested replenishment</small>
                </div>
              </div>

              <div className="section-head">
                <div>
                  <h2>Inventory health</h2>
                  <p>Products ranked by their current stock risk.</p>
                </div>
                <button className="secondary" onClick={() => setView('inventory')}>View all inventory →</button>
              </div>
              {renderInventoryTable()}

              <div className="lower-grid">
                <div className="panel">
                  <div className="panel-head">
                    <div>
                      <h3>How StockPilot scores inventory</h3>
                      <p>Three signals inform each product's priority.</p>
                    </div>
                    <span className="info">ⓘ</span>
                  </div>
                  <div className="formula">
                    <div><b>01</b><span>Stock on hand</span></div>
                    <div><b>02</b><span>Sales velocity</span></div>
                    <div><b>03</b><span>Supplier lead time</span></div>
                  </div>
                  <p className="formula-note">
                    Products with fewer days of stock coverage relative to supplier lead time receive higher priority, helping merchants act before a stockout.
                  </p>
                </div>

                <div className="panel">
                  <div className="panel-head">
                    <div>
                      <h3>Recent activity</h3>
                      <p>Latest recorded store actions.</p>
                    </div>
                    <a href="#activity" onClick={(event) => { event.preventDefault(); setView('activity'); }}>View all →</a>
                  </div>
                  <div className="activity-list">
                    {data.activity.length > 0 ? data.activity.slice(0, 4).map((item) => (
                      <div className="activity-item" key={item.id}>
                        <span className="activity-dot">✓</span>
                        <div>
                          <b>{item.action}</b>
                          <p>{item.detail}</p>
                          <small>{dateLabel(item.createdAt)}</small>
                        </div>
                      </div>
                    )) : (
                      <p className="subhead">No activity recorded yet. Create a restock plan to get started.</p>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {view === 'inventory' && (
            <>
              <div className="metrics">
                <div className="metric"><div className="metric-top">Total products <i>▦</i></div><strong>{data.summary.totalProducts}</strong><small>Products monitored</small></div>
                <div className="metric"><div className="metric-top">Critical <i className="red">!</i></div><strong>{data.summary.critical}</strong><small>Urgent attention</small></div>
                <div className="metric"><div className="metric-top">Watch <i className="amber">◷</i></div><strong>{data.summary.watch}</strong><small>Monitor closely</small></div>
                <div className="metric"><div className="metric-top">Healthy <i>✓</i></div><strong>{data.summary.healthy}</strong><small>Stock coverage looks good</small></div>
              </div>
              {renderInventoryTable()}
            </>
          )}

          {view === 'restock' && renderRestockPlans()}
          {view === 'activity' && renderActivity()}

          {view === 'settings' && (
            <div className="panel">
              <div className="panel-head">
                <div>
                  <h3>Environment settings</h3>
                  <p>Current StockPilot application configuration.</p>
                </div>
              </div>
              <div className="activity-list">
                <div className="activity-item"><span className="activity-dot">✓</span><div><b>Store</b><p>Morrow &amp; Moss development store</p></div></div>
                <div className="activity-item"><span className="activity-dot">✓</span><div><b>Application mode</b><p>Demo mode with MySQL persistence</p></div></div>
                <div className="activity-item"><span className="activity-dot">✓</span><div><b>Database</b><p>MySQL with Drizzle ORM</p></div></div>
                <div className="activity-item"><span className="activity-dot">✓</span><div><b>Inventory engine</b><p>Stock coverage, daily sales velocity, and supplier lead-time scoring</p></div></div>
              </div>
            </div>
          )}

          <footer>
            StockPilot · Inventory intelligence for growing stores
            <span>Built for Morrow &amp; Moss</span>
          </footer>
        </div>
      </main>

      {selectedProduct && (
        <div className="modal-backdrop" onClick={() => !saving && setSelectedProduct(null)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedProduct(null)} aria-label="Close">×</button>
            <p className="eyebrow">INVENTORY MANAGEMENT</p>
            <h2>Create restock plan</h2>
            <p className="subhead">Create a draft replenishment plan for a product.</p>

            <label>
              Product
              <select
                value={selectedProduct.id}
                onChange={(event) => {
                  const product = products.find((item) => item.id === Number(event.target.value));
                  if (product) openPlan(product);
                }}
              >
                {products.map((product) => (
                  <option key={product.id} value={product.id}>{product.title}</option>
                ))}
              </select>
            </label>

            <label>
              Reorder quantity
              <input
                type="number"
                min="1"
                max="100000"
                value={quantity}
                onChange={(event) => setQuantity(Math.max(1, Number(event.target.value)))}
              />
            </label>

            <div className="modal-summary">
              <span>Current stock</span><b>{selectedProduct.available} units</b>
              <span>Daily sales</span><b>{selectedProduct.dailySales.toFixed(1)} units</b>
              <span>Supplier lead time</span><b>{selectedProduct.leadTimeDays} days</b>
            </div>

            <button className="primary full" disabled={saving || quantity < 1} onClick={() => void savePlan()}>
              {saving ? 'Creating plan...' : 'Create draft plan →'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
