/**
 * Premium B2B landing for casinosystem.app — root-domain catch-all.
 * Custom Casino System for Land-Based Casinos.
 */

import { LandingI18nProvider } from "./landing/i18n/LandingI18nProvider";
import { SiteHeader } from "./landing/components/SiteHeader";
import { Hero } from "./landing/components/Hero";
import { BuiltForLandBased } from "./landing/components/BuiltForLandBased";
import { ModulesGrid } from "./landing/components/ModulesGrid";
import { WhyCustom } from "./landing/components/WhyCustom";
import { IntegrationProcess } from "./landing/components/IntegrationProcess";
import { ProductScreens } from "./landing/components/ProductScreens";
import { OperatorsStrip } from "./landing/components/OperatorsStrip";
import { Pricing } from "./landing/components/Pricing";
import { SolutionsGrid } from "./landing/components/SolutionsGrid";
import { AboutCMS } from "./landing/components/AboutCMS";
import { ContactForm } from "./landing/components/ContactForm";
import { SiteFooter } from "./landing/components/SiteFooter";

import "./landing/landing.css";

export default function Landing() {
  return (
    <LandingI18nProvider>
      <div className="landing-root">
        <SiteHeader />
        <main>
          <Hero />
          <BuiltForLandBased />
          <ModulesGrid />
          <WhyCustom />
          <IntegrationProcess />
          <ProductScreens />
          <OperatorsStrip />
          <Pricing />
          <SolutionsGrid />
          <AboutCMS />
          <ContactForm />
        </main>
        <SiteFooter />
      </div>
    </LandingI18nProvider>
  );
}
