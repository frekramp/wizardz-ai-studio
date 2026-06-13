import type { Metadata } from "next";
import { LegalPage, H2, P } from "@/components/legal-page";

export const metadata: Metadata = { title: "FAQ · Wizardz AI Studio" };

export default function FaqPage() {
  return (
    <LegalPage title="FAQ">
      <H2>What is Wizardz AI Studio?</H2>
      <P>
        A tool that turns a text prompt into a Wizardz-style wizard — as a still
        image or an animated GIF — in the spirit of the 333 animated Wizardz
        ordinals.
      </P>

      <H2>Image vs GIF — what&rsquo;s the difference?</H2>
      <P>
        <strong className="text-ink">Image</strong> generates a still wizard
        from your prompt. <strong className="text-ink">GIF</strong> generates a
        short looping animation — perfect for stickers and posts.
      </P>

      <H2>Do I need to own a Wizardz?</H2>
      <P>
        No — anyone can try it. Public results are watermarked and limited.
        Verified holders unlock the full studio: no watermark, higher limits,
        animation, and sticker-pack exports.
      </P>

      <H2>Is it free?</H2>
      <P>
        The public teaser is free (watermarked). Holder features are a perk of
        owning a Wizardz — there are no on-site payments.
      </P>

      <H2>How does wallet verification work?</H2>
      <P>
        You connect a Bitcoin wallet and sign a message. That proves you hold a
        Wizardz ordinal so we can unlock holder features. We never take custody
        of your wallet and can&rsquo;t move your assets.
      </P>

      <H2>Do you store my prompts or outputs?</H2>
      <P>
        Outputs may be stored so you can view and share them; see the{" "}
        <a className="text-orange hover:underline" href="/privacy">
          Privacy Policy
        </a>
        . We don&rsquo;t sell your data.
      </P>

      <H2>How do I become a holder?</H2>
      <P>
        The collection is sold out, so you&rsquo;d buy one on the secondary
        market — Wizardz trade on{" "}
        <a
          className="text-orange hover:underline"
          href="https://www.satflow.com/ordinals/wizardz"
          target="_blank"
          rel="noreferrer"
        >
          Satflow
        </a>
        .
      </P>
    </LegalPage>
  );
}
