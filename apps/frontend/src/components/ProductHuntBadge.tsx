import { useTheme } from '../context/ThemeContext.js';
import './ProductHuntBadge.css';

const PRODUCT_HUNT_URL =
  'https://www.producthunt.com/products/slim-svg?utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-slim-svg';

const BADGE_IMAGE_BASE =
  'https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1163145';

export default function ProductHuntBadge() {
  const { theme } = useTheme();
  const badgeSrc = `${BADGE_IMAGE_BASE}&theme=${theme}`;

  return (
    <a
      href={PRODUCT_HUNT_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="product-hunt-badge"
      aria-label="Slim SVG on Product Hunt — open product page"
    >
      <img
        src={badgeSrc}
        alt="Slim SVG — SVGs were never meant to carry this much emotional baggage. | Product Hunt"
        width={250}
        height={54}
        className="product-hunt-badge__img"
      />
    </a>
  );
}
