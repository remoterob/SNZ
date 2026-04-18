// Reusable hook for triggering Stripe Checkout
// Usage: const { checkout, loading, error } = useStripeCheckout()
// Then: checkout({ type: 'membership', memberId, amountCents: 1000, ... })

import { useState } from 'react'

export function useStripeCheckout() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const checkout = async (params) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/.netlify/functions/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create checkout session')
      // Redirect to Stripe Checkout
      window.location.href = data.url
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return { checkout, loading, error }
}
