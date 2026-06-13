import type { Metadata } from "next";
import { LegalPage, H2, P, Bullets } from "@/components/legal-page";

export const metadata: Metadata = { title: "Privacy Policy · Wizardz AI Studio" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="June 5, 2026">
      <P>
        Wizardz AI Studio (&ldquo;the Studio&rdquo;, &ldquo;we&rdquo;) lets you
        generate Wizardz-style images and GIFs from text prompts. This policy
        explains what we handle and why. We try to collect as little as
        possible.
      </P>

      <H2>What we collect</H2>
      <Bullets
        items={[
          "Prompts & settings you submit (the text and options you choose to generate with).",
          "Generated outputs (the images/GIFs the Studio creates for you).",
          "Your Bitcoin wallet address and a one-time message signature, only when you choose to connect, to verify you hold a Wizardz ordinal.",
          "Basic, aggregated usage analytics and standard server logs (e.g. page views, errors).",
        ]}
      />

      <H2>What we never do</H2>
      <Bullets
        items={[
          "We never take custody of your wallet, funds, or ordinals.",
          "We never ask for your private keys or seed phrase. A signature only proves ownership — it cannot move assets.",
          "We don't sell your data.",
        ]}
      />

      <H2>How generation works</H2>
      <P>
        Prompts and the resulting outputs are processed by our AI generation
        provider (fal.ai) to create your image or GIF. Outputs may be stored on
        object storage so you can view, download, and share them.
      </P>

      <H2>Third parties we rely on</H2>
      <Bullets
        items={[
          "fal.ai — AI image & video/GIF generation.",
          "Cloudflare — hosting, storage, and bot protection.",
          "Bitcoin ordinal indexers & Satflow — verifying Wizardz ownership and showing floor/market data.",
        ]}
      />

      <H2>Cookies & analytics</H2>
      <P>
        We use minimal cookies/local storage for core functionality (such as
        remembering a connected wallet session) and privacy-respecting,
        aggregate analytics. We don&rsquo;t use cross-site advertising trackers.
      </P>

      <H2>Data retention & your choices</H2>
      <P>
        You can disconnect your wallet at any time. You may request deletion of
        outputs associated with your wallet by contacting us. We keep generated
        outputs only as long as needed to provide the Studio.
      </P>

      <H2>Changes</H2>
      <P>
        We may update this policy; we&rsquo;ll revise the date above when we do.
      </P>

      <H2>Contact</H2>
      <P>Reach us on X at @wizardzBTC.</P>
    </LegalPage>
  );
}
