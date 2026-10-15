// Public configuration only. Leave empty until the Worker is configured and tested.
export const FIRE_WORKER_URL = '';

// Public token information. Insert verified URLs/actual contract terms only.
// Contract and access threshold are NOT duplicated here: the existing Worker
// /status supplies FIRE_CONTRACT and MINIMUM_FIRE from wrangler.jsonc.
export const FIRE_TOKEN_INFORMATION = {
  nearlyTradeUrl: '',
  explorerUrl: '',
  fees: {
    buyTax: '',
    sellTax: '',
    burnAllocation: '',
    creatorFees: '',
    platformFees: ''
  }
};
