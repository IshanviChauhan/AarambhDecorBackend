// Paytm Configuration
const paytmConfig = {
  MID: process.env.PAYTM_MID || "your_merchant_id", // Replace with your Paytm Merchant ID
  MERCHANT_KEY: process.env.PAYTM_MERCHANT_KEY || "your_merchant_key", // Replace with your Paytm Merchant Key
  WEBSITE: process.env.PAYTM_WEBSITE || "WEBSTAGING", // Use "DEFAULT" for production
  CHANNEL_ID: "WEB",
  INDUSTRY_TYPE_ID: "Retail",
  ORDER_ID_PREFIX: "AARAMB_",
  CALLBACK_URL: process.env.PAYTM_CALLBACK_URL || "http://localhost:5000/api/payments/paytm/callback",
  // Paytm URLs
  STAGING_URL: "https://securegw-stage.paytm.in/theia/processTransaction",
  PRODUCTION_URL: "https://securegw.paytm.in/theia/processTransaction",
  STATUS_QUERY_URL_STAGING: "https://securegw-stage.paytm.in/v3/order/status",
  STATUS_QUERY_URL_PRODUCTION: "https://securegw.paytm.in/v3/order/status"
};

// Environment-based URL selection
paytmConfig.TRANSACTION_URL = process.env.NODE_ENV === 'production' 
  ? paytmConfig.PRODUCTION_URL 
  : paytmConfig.STAGING_URL;

paytmConfig.STATUS_QUERY_URL = process.env.NODE_ENV === 'production'
  ? paytmConfig.STATUS_QUERY_URL_PRODUCTION
  : paytmConfig.STATUS_QUERY_URL_STAGING;

module.exports = paytmConfig;
