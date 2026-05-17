import { useEffect } from 'react';
import Navbar from '../components/Navbar';
import Hero from '../components/Hero';
import Features from '../components/Features';
import Pricing from '../components/Pricing';
import Installation from '../components/Installation';
import Footer from '../components/Footer';

const Landing = () => {
  useEffect(() => {
    // Premium entry scroll-to-top
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="text-white selection:bg-brand-primary selection:text-white bg-obsidian-950 font-sans overflow-x-hidden">
      <Navbar />
      <main>
        <Hero />
        <Features />
        <Installation />
        <Pricing />
      </main>
      <Footer />
    </div>
  );
};

export default Landing;