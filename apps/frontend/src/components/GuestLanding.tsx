import GoogleSignInButton from '../components/GoogleSignInButton';
import GuestLandingRive from './GuestLandingRive';
import './GuestLanding.css';

const FEATURE_IMAGES = {
  squeezing: '/landing/features/squeezing.svg',
  complexity: '/landing/features/complexity.svg',
  webp: '/landing/features/webp.svg',
} as const;

const FEATURES = [
  {
    title: "We'll keep squeezing.",
    desc: "Your SVG says it's optimised. We don't believe it. Slim keeps running iterations until there are no meaningful bytes left to steal.",
    image: FEATURE_IMAGES.squeezing,
    imageAlt: 'Optimisation illustration',
  },
  {
    title: "Somebody exported this from Figma, didn't they?",
    desc: "10,000-point paths. Gradient soup. PNGs hiding inside SVGs. We'll find the weird stuff before Android has to.",
    image: FEATURE_IMAGES.complexity,
    imageAlt: 'Complexity analysis illustration',
  },
  {
    title: "Not everything deserves to be a vector.",
    desc: "Sometimes the correct SVG optimisation strategy is admitting it should've been a WebP. Slim isn't afraid to have that conversation.",
    image: FEATURE_IMAGES.webp,
    imageAlt: 'WebP conversion illustration',
  },
] as const;

interface Props {
  onSignIn: () => void;
}

export default function GuestLanding({ onSignIn }: Props) {
  return (
    <div className="guest-landing">
      <section className="guest-landing__hero">
        <h1 className="guest-landing__headline">
          Stop <span aria-hidden>✋</span> shipping SVGs that <br></br>hate{' '}
          <span className="guest-landing__headline-accent">Android.</span>
        </h1>
        <p className="guest-landing__subhead">
          Automatically optimise vectors, detect complexity, and convert problem assets before
          they become performance issues.
        </p>
      </section>

      <section className="guest-landing__sign-in-section">
        <div className="guest-landing__sign-in-card">
          <div className="guest-landing__cta-icon" aria-hidden>
            <GuestLandingRive />
          </div>
          <p className="guest-landing__sign-in-text">
            Sign in with Google to upload your SVG assets privately
          </p>
          <GoogleSignInButton variant="solid" fullWidth onClick={onSignIn} />
        </div>
      </section>

      <section className="guest-landing__features">
        {FEATURES.map((item) => (
          <article key={item.title} className="guest-landing__feature-card">
            <div className="guest-landing__feature-media">
              <img
                src={item.image}
                alt={item.imageAlt}
                className="guest-landing__feature-image"
                loading="lazy"
              />
            </div>
            <div className="guest-landing__feature-body">
              <h3 className="guest-landing__feature-title">{item.title}</h3>
              <p className="guest-landing__feature-desc">{item.desc}</p>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
