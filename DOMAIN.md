# Pointing ninefall.app at Vercel (OVH keeps the DNS)

The Vercel side is done: the project is `ninefall-site` under `foxtamings-projects`,
and both `ninefall.app` and `www.ninefall.app` are already attached to it. The only
thing left is four records in the OVH DNS zone.

Live right now at **https://ninefall-site.vercel.app**

## What is left in the OVH zone (checked 8 September 2026)

`www` has already been pointed at Vercel and the apex AAAA is gone. Three records
remain.

| Record | Name | Value | What to do |
|---|---|---|---|
| A | `@` | `188.165.6.20` | **change** to `76.76.21.21` |
| AAAA | `www` | `2001:41d0:301:3::21` | **delete** |
| TXT | `www` | `"3\|welcome"` | delete (OVH parking marker) |
| TXT | `@` | `"1\|www.ninefall.app"` | delete (OVH redirect marker) |
| CNAME | `ftp` | `ninefall.app.` | delete if you like; Vercel serves no FTP |
| A | `www` | `76.76.21.21` | already correct, leave it |

Everything else in the zone is mail or delegation and must be left exactly as it is:
the three `MX` records, the `SPF` record, the `_autodiscover._tcp`, `_imaps._tcp` and
`_submission._tcp` `SRV` records, the `autoconfig`, `autodiscover`, `imap`, `mail`,
`pop3` and `smtp` `CNAME`s, and the two `NS` records. Those carry
`contact@ninefall.app`.

The leftover `www` AAAA is not theoretical. `www.ninefall.app` already resolves to
Vercel over IPv4, yet it still serves OVH's "Site under construction" page, because
browsers prefer IPv6 and the AAAA still points at OVH. Deleting it fixes www.

## Steps in the OVH manager

1. Go to **ovh.com/manager** → **Web Cloud** → **Domain names** → **ninefall.app**.
2. Open the **DNS zone** tab.
3. Edit the **A** record whose subdomain is empty (`@`): replace `188.165.6.20` with
   `76.76.21.21`. Confirm.
4. Delete the **AAAA** record on `www`.
5. Delete the two OVH marker **TXT** records: `"1|www.ninefall.app"` on `@` and
   `"3|welcome"` on `www`.
6. If **Redirection** in the left menu still lists a redirect for the domain or for
   `www`, remove it. It will keep recreating those TXT markers otherwise.
7. Leave every mail record alone. See the table above for the full list.

`www` is an A record rather than a CNAME. That is fine, and it is what
`vercel domains inspect` recommends. A CNAME to `cname.vercel-dns.com.` would be
marginally more future-proof if Vercel ever changes that IP, but it is not worth
redoing today.

## Then

Nothing else to do. Vercel notices the records, verifies the domain and issues the
TLS certificate on its own, usually within a few minutes of the records going live.
OVH's default TTL is one hour, so allow up to an hour, occasionally a few hours.

Check progress with:

```bash
dig +short A ninefall.app @1.1.1.1        # want 76.76.21.21
dig +short AAAA ninefall.app @1.1.1.1     # want nothing at all
curl -sI https://ninefall.app | head -1   # want HTTP/2 200
```

`.app` is on the HSTS preload list, so it is HTTPS-only by design. Until Vercel has
issued the certificate the domain will look broken rather than insecure. That is
expected, and it resolves itself.

## One click in the Vercel dashboard

In **Project → Settings → Domains**, set `www.ninefall.app` to **redirect to**
`ninefall.app`. The apex has to be canonical: the App Clip association
(`appclips:ninefall.app`) and every shared board link (`https://ninefall.app/p/...`)
are bound to the bare domain.

## After the domain is live

- Update the App Store metadata to the new URLs, in
  `ios/fastlane/metadata/en-US/` of the Ninefall repo. All three still point at
  `fox1304.github.io/ninefall-site`: `marketing_url.txt` → `https://ninefall.app/`,
  `support_url.txt` → `https://ninefall.app/support`, `privacy_url.txt` →
  `https://ninefall.app/privacy`. Same for the eight other locales.
- Universal links into the full app need `applinks:ninefall.app` added to
  `ios/Ninefall/Ninefall.entitlements`. Only the App Clip declares an associated
  domain today, so `/p/` links open the App Clip or the website, not the installed
  app, until the next build ships with that entitlement.
