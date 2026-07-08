import type { Metadata } from "next";

import { LibraryBrowser } from "@/components/site/library-browser";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteNav } from "@/components/site/site-nav";

export const metadata: Metadata = {
  title: "Asset Library - Imagen",
  description: "Browse reusable AI image prompts and generated image references from Imagen.",
};

export default function LibraryPage() {
  return (
    <>
      <div className="bg-surface-950">
        <SiteNav />
      </div>
      <LibraryBrowser />
      <SiteFooter />
    </>
  );
}
