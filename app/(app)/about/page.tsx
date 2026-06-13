import type { Metadata } from "next";
import { LegalPage, H2, P } from "@/components/legal-page";

export const metadata: Metadata = { title: "About · Wizardz AI Studio" };

export default function AboutPage() {
  return (
    <LegalPage title="About Wizardz">
      <H2>The collection</H2>
      <P>
        Wizardz is a collection of <strong className="text-ink">333 animated
        wizards</strong> inscribed on Bitcoin&rsquo;s uncommon sats — a small,
        sold-out ordinals collection with its own art and lore.
      </P>

      <H2>The Studio</H2>
      <P>
        Wizardz AI Studio lets the community conjure wizard images and GIFs from
        a prompt — a playground that makes the brand more fun to share and more
        valuable to hold. Holders unlock the full, unwatermarked, animated
        experience.
      </P>

      <H2>Links</H2>
      <P>
        <a className="text-orange hover:underline" href="https://wizardz.art" target="_blank" rel="noreferrer">
          wizardz.art
        </a>{" "}
        ·{" "}
        <a className="text-orange hover:underline" href="https://x.com/wizardzBTC" target="_blank" rel="noreferrer">
          @wizardzBTC
        </a>{" "}
        ·{" "}
        <a className="text-orange hover:underline" href="https://www.satflow.com/ordinals/wizardz" target="_blank" rel="noreferrer">
          Satflow
        </a>
      </P>
    </LegalPage>
  );
}
