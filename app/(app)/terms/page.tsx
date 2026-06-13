import type { Metadata } from "next";
import { LegalPage, H2, P, Bullets } from "@/components/legal-page";

export const metadata: Metadata = { title: "Terms of Service · Wizardz AI Studio" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="June 5, 2026">
      <P>
        By using Wizardz AI Studio (&ldquo;the Studio&rdquo;) you agree to these
        terms. If you don&rsquo;t agree, please don&rsquo;t use it.
      </P>

      <H2>The service</H2>
      <P>
        The Studio is an AI image &amp; GIF generator for the Wizardz brand. A
        free public version produces watermarked results; verified Wizardz
        holders unlock the full studio (no watermark, higher limits, animation
        and sticker exports).
      </P>

      <H2>Acceptable use</H2>
      <Bullets
        items={[
          "Don't generate illegal, infringing, hateful, or sexual content involving real or minor individuals.",
          "Don't attempt to bypass watermarks, rate limits, or the ownership gate.",
          "Don't abuse, overload, scrape, or disrupt the service.",
          "You're responsible for the prompts you submit and how you use the outputs.",
        ]}
      />

      <H2>Wallet &amp; ownership</H2>
      <P>
        Connecting a Bitcoin wallet and signing a message verifies that you hold
        a Wizardz ordinal so we can unlock holder features. We never custody
        your assets and cannot move them. Holder perks may change over time.
      </P>

      <H2>Intellectual property</H2>
      <Bullets
        items={[
          "The Wizardz name, logo, and collection art belong to Wizardz and its rights holders.",
          "Subject to these terms and acceptable use, you may use the outputs you generate for personal and community purposes.",
          "Don't imply official endorsement beyond what's true, and respect the brand.",
        ]}
      />

      <H2>No financial advice</H2>
      <P>
        Ordinals are volatile and speculative. Nothing in the Studio is
        financial or investment advice. Any purchase happens on third-party
        marketplaces (e.g. Satflow) that we do not operate or control.
      </P>

      <H2>Disclaimers &amp; liability</H2>
      <P>
        The Studio is provided &ldquo;as is,&rdquo; without warranties. To the
        maximum extent permitted by law, we are not liable for indirect or
        consequential damages arising from your use of the Studio.
      </P>

      <H2>Changes &amp; termination</H2>
      <P>
        We may update these terms or suspend access for misuse. Continued use
        means you accept the current terms.
      </P>

      <H2>Contact</H2>
      <P>Reach us on X at @wizardzBTC.</P>
    </LegalPage>
  );
}
