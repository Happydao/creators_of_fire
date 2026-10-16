// Public service URL. Access stays locked until the Worker reports ready.
export const FIRE_WORKER_URL = 'https://creators-of-fire-access.creators-of-fire.workers.dev';

// Public token information. Insert verified URLs/actual contract terms only.
// Contract and access threshold are NOT duplicated here: the existing Worker
// /status supplies FIRE_CONTRACT and MINIMUM_FIRE from wrangler.jsonc.
export const FIRE_TOKEN_INFORMATION = {
  // Set only after confirming the exclusive music service works end to end.
  serviceLive: false,
  // Explicit owner release decision after reviewing applicable regulatory obligations.
  // This flag is not a legal certification. A URL or contract alone never enables GET.
  tradingEnabled: false,
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
