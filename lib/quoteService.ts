'use client'

export type Quote = {
  text: string
  author: string
}

type CachedQuote = {
  quote: Quote
  date: string // YYYY-MM-DD format
}

const CACHE_KEY = 'daily_stoic_quote'
const API_URL = 'https://stoic.tekloon.net/stoic-quote'
const FETCH_TIMEOUT = 5000 // 5 seconds

// Fallback Stoic quotes
const fallbackQuotes: Quote[] = [
  { text: "You have power over your mind — not outside events. Realize this, and you will find strength.", author: "Marcus Aurelius" },
  { text: "We suffer more often in imagination than in reality.", author: "Seneca" },
  { text: "It is a rough road that leads to the heights of greatness.", author: "Seneca" },
  { text: "First say to yourself what you would be; and then do what you have to do.", author: "Epictetus" },
  { text: "He who fears death will never do anything worthy of a man who is alive.", author: "Seneca" },
  { text: "Waste no more time arguing about what a good man should be. Be one.", author: "Marcus Aurelius" },
  { text: "The happiness of your life depends upon the quality of your thoughts.", author: "Marcus Aurelius" },
  { text: "No man is free who is not master of himself.", author: "Epictetus" },
  { text: "Difficulties strengthen the mind, as labor does the body.", author: "Seneca" },
  { text: "How long are you going to wait before you demand the best for yourself?", author: "Epictetus" },
  { text: "The best revenge is not to be like your enemy.", author: "Marcus Aurelius" },
  { text: "It is not the man who has too little, but the man who craves more, that is poor.", author: "Seneca" },
  { text: "Man conquers the world by conquering himself.", author: "Zeno of Citium" },
  { text: "If it is not right, do not do it; if it is not true, do not say it.", author: "Marcus Aurelius" },
  { text: "He suffers more than necessary, who suffers before it is necessary.", author: "Seneca" },
]

function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

function getRandomFallbackQuote(): Quote {
  // Use day of year for consistent daily fallback
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000)
  return fallbackQuotes[dayOfYear % fallbackQuotes.length]
}

function getCachedQuote(): CachedQuote | null {
  if (typeof window === 'undefined') return null

  try {
    const cached = localStorage.getItem(CACHE_KEY)
    if (!cached) return null
    return JSON.parse(cached) as CachedQuote
  } catch {
    return null
  }
}

function setCachedQuote(quote: Quote): void {
  if (typeof window === 'undefined') return

  const cached: CachedQuote = {
    quote,
    date: getTodayKey(),
  }
  localStorage.setItem(CACHE_KEY, JSON.stringify(cached))
}

async function fetchQuoteFromAPI(): Promise<Quote | null> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT)

    const response = await fetch(API_URL, {
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!response.ok) {
      return null
    }

    const data = await response.json()

    // Validate response structure
    if (data?.data?.quote && data?.data?.author) {
      return {
        text: data.data.quote,
        author: data.data.author,
      }
    }

    return null
  } catch {
    return null
  }
}

export async function getDailyQuote(): Promise<Quote> {
  const today = getTodayKey()
  const cached = getCachedQuote()

  // Return cached quote if it's from today
  if (cached && cached.date === today) {
    return cached.quote
  }

  // Try to fetch from API
  const apiQuote = await fetchQuoteFromAPI()

  if (apiQuote) {
    setCachedQuote(apiQuote)
    return apiQuote
  }

  // Fallback to hardcoded quotes
  const fallback = getRandomFallbackQuote()
  setCachedQuote(fallback)
  return fallback
}

export async function refreshQuote(): Promise<Quote> {
  // Force fetch a new quote from API
  const apiQuote = await fetchQuoteFromAPI()

  if (apiQuote) {
    setCachedQuote(apiQuote)
    return apiQuote
  }

  // If API fails, get a random fallback (different from current)
  const cached = getCachedQuote()
  let fallback = fallbackQuotes[Math.floor(Math.random() * fallbackQuotes.length)]

  // Try to get a different quote than the current one
  if (cached && fallback.text === cached.quote.text) {
    const index = fallbackQuotes.findIndex(q => q.text === cached.quote.text)
    fallback = fallbackQuotes[(index + 1) % fallbackQuotes.length]
  }

  setCachedQuote(fallback)
  return fallback
}
