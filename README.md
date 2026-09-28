# Cría Cibao La Pampa

Website for [criacibaolapampa.com](https://criacibaolapampa.com), served by GitHub Pages from this repository.

It is a plain static site: no build step, no dependencies.

```
index.html           the page (English and Spanish live side by side)
assets/css/site.css  styles
assets/js/site.js    language switch, horse detail view, video player
assets/img/          web images (horses/, hero, video poster, icons)
assets/img/originals the original photos as uploaded
assets/fonts/        self-hosted fonts (Instrument Serif, Inter)
CNAME                custom domain for GitHub Pages
```

## Common edits

**Feature a YouTube video.** In `index.html`, find `data-youtube-id=""` and paste the video ID
(the part after `v=` in the link, or after `youtu.be/`). Leave it empty to link to the channel instead.

**Change the phone or WhatsApp number.** Search `index.html` for `34682327444` and
`+34 682 327 444`, and update `WA_NUMBER` in `assets/js/site.js`.

**Edit a horse.** Each horse appears twice in `index.html`: as a card (`<li class="horse" id="horse-...">`)
and in the `horse-data` JSON near the bottom, which fills the detail view. Update both.

**Link straight to one horse.** `https://criacibaolapampa.com/#horse-drogba` opens that horse's detail view.

**Language.** Visitors get Spanish if their browser is set to Spanish, otherwise English, and can switch
with the EN / ES buttons. `?lang=es` or `?lang=en` in the link forces one.
