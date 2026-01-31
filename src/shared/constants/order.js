module.exports = {
  TRANSACTION_TYPE: {
    BUY: 'BUY',
    SELL: 'SELL',
  },
  
  ORDER_TYPE: {
    MARKET: 'MARKET',
    LIMIT: 'LIMIT',
    SL: 'SL',
    SL_M: 'SL-M',
  },
  
  PRODUCT_TYPE: {
    CNC: 'CNC',
    MIS: 'MIS',
    NRML: 'NRML',
  },
  
  ORDER_STATUS: {
    PENDING: 'PENDING',
    SUBMITTED: 'SUBMITTED',
    OPEN: 'OPEN',
    COMPLETE: 'COMPLETE',
    CANCELLED: 'CANCELLED',
    REJECTED: 'REJECTED',
    FAILED: 'FAILED',
  },
  
  EXCHANGE: {
    NSE: 'NSE',
    BSE: 'BSE',
    NFO: 'NFO',
    BFO: 'BFO',
    CDS: 'CDS',
    MCX: 'MCX',
  },
  
  VALIDITY: {
    DAY: 'DAY',
    IOC: 'IOC',
  },
  
  SIGNAL_SOURCE: {
    TELEGRAM: 'TELEGRAM',
    GOOGLE_SHEETS: 'GOOGLE_SHEETS',
    MANUAL: 'MANUAL',
    API: 'API',
  },
};