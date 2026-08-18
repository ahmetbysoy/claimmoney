import { useEffect, useRef, useState } from 'react'

interface Props { price: number; symbol: string }

export function PriceTicker({ price, symbol }: Props) {
  const previous = useRef(price)
  const [direction, setDirection] = useState<'up' | 'down' | 'flat'>('flat')

  useEffect(() => {
    setDirection(price > previous.current ? 'up' : price < previous.current ? 'down' : 'flat')
    previous.current = price
  }, [price])

  const formatted = Number.isFinite(price)
    ? price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '—'

  return (
    <div className="price-ticker">
      <span className="price-ticker__symbol">{symbol}</span>
      <span className="price-ticker__price" data-testid="price-ticker" data-price={price} data-direction={direction} aria-label={`${symbol} fiyatı ${formatted}`}>
        {formatted}
      </span>
    </div>
  )
}
