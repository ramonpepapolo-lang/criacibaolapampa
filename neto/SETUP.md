# Neto · landing page setup

A one-page waitlist site to test demand for Neto. It's plain HTML, CSS and JavaScript with no build step.

| What | Service | Cost |
|---|---|---|
| Hosting | Netlify (Free plan, commercial use allowed) | free |
| Sign-ups + CSV export | Netlify Forms (built in, no extra account) | free, unlimited |
| Analytics, no cookies | Umami Cloud (Hobby plan) | free |

This folder (`neto/`) lives inside the `criacibaolapampa` repository but is completely separate from
the horse website. Netlify publishes **only this folder**. **Do not merge this branch into `main`**:
GitHub Pages serves `main` at criacibaolapampa.com, so a merge would also put a copy of this page
(with a form that doesn't work there) at criacibaolapampa.com/neto/.

## Files

```
index.html          the page (all copy is here, in Spanish)
styles.css          design (colours are at the top, under :root)
app.js              example-dashboard toggle, form sending, share buttons, analytics events
config.js           the one setting you fill in: the Umami website ID
gracias.html        thank-you page, used only if JavaScript is off
netlify.toml        Netlify settings (no build, security headers)
favicon.svg, apple-touch-icon.png, og.png   icons and the WhatsApp/social preview image
fonts/              Inter, self-hosted (no Google Fonts, no third-party requests)
```

## 1. Put the site online (Netlify), about 3 minutes

1. Go to **app.netlify.com/signup** and click **Sign up with GitHub**, then **Authorize Netlify**.
2. Click **Add new project** (or "Add new site"), then **Import an existing project**, then **GitHub**.
   If asked, click **Configure the Netlify app on GitHub** and allow access to
   `criacibaolapampa` (you can choose "Only select repositories").
3. Pick **criacibaolapampa** and fill in:
   - **Branch to deploy:** `claude/kind-feynman-7o5u3u`
   - **Base directory:** `neto`
   - **Build command:** leave empty
   - **Publish directory:** leave as Netlify fills it (`neto`)
4. Click **Deploy**. After a minute you get an address like `random-name-123.netlify.app`.
5. Nicer address: **Project configuration**, then **Change project name**, and type `neto-ar`
   (or anything free). The site becomes `neto-ar.netlify.app`.

## 2. Turn on the form, 1 minute (required, or sign-ups are lost)

Netlify ships new sites with form detection **switched off**.

1. In your Netlify project, open **Forms** in the left menu, then click **Enable form detection**.
2. Go to **Deploys**, then **Trigger deploy**, then **Deploy project** (or "Deploy site").
   Netlify only finds the form on a fresh deploy.
3. Back in **Forms** you should now see a form called **lista-de-espera**.
4. Test it: open your site on your phone and sign up with your own email. It should show up
   under **Forms**, then **lista-de-espera**.
5. Optional, for an email on every sign-up: **Project configuration**, then **Notifications**,
   then **Emails and webhooks**, then **Form submission notifications**, then
   **Add notification**, then **Email notification**.

**Export as CSV:** **Forms**, then **lista-de-espera**, then **Download as CSV**.
Columns: `email`, `brokers` (comma separated), `broker_otro`, `cartera`, `pagaria_informe`,
`utm_source`, `utm_medium`, `utm_campaign`, `referrer`, plus the date.

Netlify filters spam on its own. Now and then check **Spam submissions** on the same page, in case a
real person ended up there.

## 3. Analytics without cookies (Umami), 2 minutes

Plausible has no free plan, so this uses Umami Cloud, which is free and cookieless.

1. Go to **cloud.umami.is**, click **Sign up** and create an account.
2. Click **Add website**. Name: `Neto`. Domain: your Netlify address, e.g. `neto-ar.netlify.app`. Click **Save**.
3. Open the website's **Edit** page and copy the **Website ID** (it looks like `1a2b3c4d-...`).
4. Paste the ID into `config.js` (`UMAMI_WEBSITE_ID: '...'`), or send it to Claude and it will do it.
   Netlify republishes on its own in about a minute.

What you'll see in Umami:
- visits, where they came from, and phone vs desktop
- events: `cta-hero`, `cta-header`, `cta-faq`, `cta-ver-ejemplo` (button clicks),
  `demo-moneda` (played with the example), `form-empezado` (started the form),
  `anotado` (signed up; includes `pagaria`, `cartera` and number of brokers),
  `form-error-envio`, `share-whatsapp`, `share-copiar`

**Conversion rate** = `anotado` events ÷ unique visitors.

## Tracking where people come from

Add `?utm_source=...` to the link you share, for example:

- `https://neto-ar.netlify.app/?utm_source=instagram`
- `https://neto-ar.netlify.app/?utm_source=whatsapp&utm_campaign=grupo-inversores`
- `https://neto-ar.netlify.app/?utm_source=reddit`

It's saved with each sign-up (CSV column `utm_source`), so you can see which channel brings
people who would pay. Links shared from the thank-you screen get `utm_source=compartido`.

## After you have the final address

The social preview image (`og.png`) is linked with a relative path, which WhatsApp and Facebook don't
always load. Once the address is final, change `content="og.png"` in `index.html` to the full
address, e.g. `content="https://neto-ar.netlify.app/og.png"` (or ask Claude to).

## Changing things

- **Copy:** everything is in `index.html`.
- **Colours:** top of `styles.css` (`--ink`, `--green`, `--mint`, `--gold`).
- **Example numbers in the dashboard:** top of the "Ejemplo del dashboard" section in `app.js`
  (`RATES`, `NOMINAL`, `BROKERS`). They are fictional and labelled "EJEMPLO" on the page.
- **Custom domain (e.g. neto.com.ar):** in Netlify, **Domain management**, then **Add a domain**,
  then follow the DNS steps it shows.
