import { useEffect } from 'react';
import Hero from '../components/Hero';
import Features from '../components/Features';
import Pricing from '../components/Pricing';
import Installation from '../components/Installation';

const Landing = () => {
  useEffect(() => {
    // Premium entry scroll-to-top
    window.scrollTo(0, 0);
  }, []);

  return (
    <>
      <Hero />
      <Features />
      <Installation />
      <Pricing />
    </>
  );
};

export default Landing;