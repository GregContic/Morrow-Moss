document.addEventListener('DOMContentLoaded', () => {
  const builder = document.querySelector('[data-bundle-builder]');
  if (!builder) return;
  const selects = [...builder.querySelectorAll('[data-bundle-select]')];
  const total = builder.querySelector('[data-bundle-total]');
  const message = builder.querySelector('[data-bundle-message]');
  const button = builder.querySelector('[data-bundle-add]');
  const formatMoney = (cents) => new Intl.NumberFormat(document.documentElement.lang || 'en-US', {style:'currency',currency:window.Shopify?.currency?.active || 'USD'}).format(cents / 100);
  const update = () => {
    const sum = selects.reduce((value, select) => value + Number(select.selectedOptions[0]?.dataset.price || 0), 0);
    total.textContent = formatMoney(sum);
    button.disabled = selects.some(select => !select.value);
  };
  selects.forEach(select => select.addEventListener('change', update));
  update();
  button.addEventListener('click', async () => {
    const items = selects.map(select => ({id:Number(select.value),quantity:1}));
    if (items.some(item => !item.id)) return;
    button.disabled = true; message.textContent = 'Adding your little bundle…';
    try {
      const response = await fetch(`${window.Shopify?.routes?.root || '/'}cart/add.js`, {method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({items})});
      if (!response.ok) throw new Error('Some items may be unavailable. Please review your selections.');
      window.location.href = `${window.Shopify?.routes?.root || '/'}cart`;
    } catch (error) {
      message.textContent = error.message || 'Something went wrong. Please try again.';
      button.disabled = false;
    }
  });
});
