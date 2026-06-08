import type { Offer } from '../types'

type Props = {
  offers: Offer[]
}

export default function OfferPanel({ offers }: Props) {
  if (!offers.length) {
    return <div className="empty-card">暂无本地优惠卡片</div>
  }

  return (
    <div className="offer-list">
      {offers.map((offer) => (
        <div className="offer-card" key={offer.id}>
          <strong>{offer.title}</strong>
          <p>{offer.description}</p>
          <div>现金优惠：{offer.cash_discount} 元</div>
          <div>权益：{offer.gift.join('、') || '以门店确认为准'}</div>
          <small>{offer.dealer} · 有效期至 {offer.valid_until}</small>
        </div>
      ))}
    </div>
  )
}
