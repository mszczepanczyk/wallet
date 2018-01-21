import ccxt from 'ccxt'
import fetch from 'isomorphic-fetch'
import _ from 'lodash'
import { MongoClient } from 'mongodb'

import config from './config'

async function retryAsyncFun (retries, fun, thisArg, ...args) {
  while (retries--) {
    try {
      return await fun.call(thisArg, ...args)
    } catch (error) {
      if (retries === 0) {
        throw error
      }
    }
  }
}

async function getBalance (exchange) {
  const balance = await retryAsyncFun(3, exchange.fetchBalance, exchange)
    .then(data => data.total)
  return _(balance)
    .pickBy(value => value > 0)
    .mapValues((value, currency) => ({
      currency,
      name: exchange.name,
      value
    }))
    .toArray()
    .value()
}

function getUSDPrice () {
  return fetch('https://api.fixer.io/latest?base=USD&symbols=PLN')
    .then(resp => resp.json())
    .then(data => data['rates']['PLN'])
}

async function getTickersFromExchange (exchange) {
  const tickers = await retryAsyncFun(3, exchange.fetchTickers, exchange)
  if (config.mongoUrl) {
    const db = await MongoClient.connect(config.mongoUrl)
    await db
      .collection('tickers')
      .insert(Object.values(tickers).map(ticker => Object.assign({}, ticker, {
        source: exchange.id,
        format: 'ccxt'
      })))
    db.close()
  }
  return tickers
}

async function getTickersFromCoinMarketCap () {
  const tickers = await retryAsyncFun(3, fetch, this,
    'http://api.coinmarketcap.com/v1/ticker/?limit=0').then(resp => resp.json())
  if (config.mongoUrl) {
    const db = await MongoClient.connect(config.mongoUrl)
    await db
      .collection('tickers')
      .insert(tickers.map(ticker => Object.assign({}, ticker, {
        source: 'coinmarketcap',
        format: 'coinmarketcap',
        when: new Date().toISOString()
      })))
    db.close()
  }
  return _.keyBy(tickers, 'symbol')
}

function colored (val) {
  if (val > 0) {
    return `\x1b[32m${val}\x1b[0m`
  } else {
    return `\x1b[31m${val}\x1b[0m`
  }
}

async function dawej () {
  const exchanges = Object.keys(config.exchanges).map(name =>
    new ccxt[name](config.exchanges[name]))

  const getWallet = Promise
    .all(exchanges.map(e => getBalance(e)))
    .then(balances => [].concat.apply(config.initialWallet || [], balances))

  let [ wallet, usdPrice, tickers ] = await Promise.all([
    getWallet,
    getUSDPrice(),
    getTickersFromCoinMarketCap()
  ])

  wallet = _(wallet)
    .map(w => Object.assign({}, w, {
      valueUSD: tickers[w.currency]
        ? w.value * tickers[w.currency]['price_usd']
        : null,
      valuePLN: tickers[w.currency]
        ? w.value * tickers[w.currency]['price_usd'] * usdPrice
        : null
    }))
    .sortBy('valuePLN')
    .reverse()
    .value()

  const sumPLN = _(wallet).map(w => w.valuePLN).sum().valueOf()

  for (const w of wallet) {
    const tick = tickers[w.currency]
    const changes = tick
      ? `(${colored(tick.percent_change_1h)} ${colored(tick.percent_change_24h)} ${colored(tick.percent_change_7d)}) `
      : ''
    console.log(`${w.name} ${w.currency} ${changes}${w.value} -> ${w.valuePLN || '?'}`)
  }
  console.log(sumPLN)
}

dawej()
