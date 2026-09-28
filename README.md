# Cría Cibao La Pampa

Website for [criacibaolapampa.com](https://criacibaolapampa.com), served by GitHub Pages from this repository.

It is a plain static site: no build step, no dependencies.

```
index.html           the page (English and Spanish live side by side)
assets/css/site.css  styles
assets/js/site.js    language switch, horse detail view, video player, sold/updated status
admin/               owner admin page (assets/js/admin.js, assets/css/admin.css)
data/site.json       last updated date and sold horses, edited from the admin page
assets/img/          web images (horses/, hero, video poster, crest logo, icons)
assets/img/originals the original photos as uploaded
assets/fonts/        self-hosted fonts (Instrument Serif, Inter)
CNAME                custom domain for GitHub Pages
```

## Admin page

`criacibaolapampa.com/admin/` (the small "admin" link in the footer) lets the owner change,
without touching code:

- the **Last updated** date shown in the footer
- which horses show the red **SOLD / VENDIDA** band
- an **announcement bar** at the top of the site (English and Spanish; no bar when both are empty)
- **new horses**: name, details and one photo. The photo is resized in the browser and uploaded to
  `assets/img/horses/added/`; the horse is stored in `data/site.json` (`horses`, newest first) and
  `site.js` renders its card at the start of the list. Added horses can be removed again.

All of this lives in `data/site.json`, which the site reads on every visit. The admin page saves by
committing that file through the GitHub API, and GitHub Pages republishes in about a minute.

The site sends GoatCounter events `view-<slug>` when a horse's card is opened and
`enquiry-<slug>` / `enquiry-general` when an email link is clicked; the admin page ranks horses by
views and shows enquiry clicks.

It also shows **visitor numbers** (all time, today, last 7 and 30 days, and a daily chart) from
GoatCounter (`criacibaolapampa.goatcounter.com`, no cookies). The site loads GoatCounter's
`count.js`; the admin page reads its public counter JSON (`/counter/TOTAL.json?end=DATE`), which
requires "Allow adding visitor counts on your website" in the GoatCounter settings.

The admin password only opens the page. Saving also needs a GitHub key (a personal access token
with the `public_repo` scope), entered once per device and stored only in that browser, encrypted
with the password. The password check lives in public code, so the GitHub key is what really
protects the site. To change the password, update `PASS_HASH` in `assets/js/admin.js`
(sha256 of `cria-cibao-admin:` + the new password); each device then connects again once.


**Change the featured video.** In `index.html`, find `youtube-nocookie.com/embed/` and replace the ID
after it with the new one (the part after `shorts/`, `v=` or `youtu.be/` in the YouTube link). The
player is vertical, sized for YouTube Shorts.

**Change the contact email.** Search `index.html` for `info@criacibaolapampa.com` and update
`EMAIL` in `assets/js/site.js`. The address is a forwarder set up in Namecheap
(Domain List, Manage, Redirect Email), so messages land in your normal inbox.

**Edit a horse.** Each horse appears twice in `index.html`: as a card (`<li class="horse" id="horse-...">`)
and in the `horse-data` JSON near the bottom, which fills the detail view. Update both.

**Link straight to one horse.** `https://criacibaolapampa.com/#horse-drogba` opens that horse's detail view.

**Language.** Visitors get Spanish if their browser is set to Spanish, otherwise English, and can switch
with the EN / ES buttons. `?lang=es` or `?lang=en` in the link forces one.
