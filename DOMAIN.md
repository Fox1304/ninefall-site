# Pointing ninefall.app at Vercel (OVH keeps the DNS)

The Vercel side is done: the project is `ninefall-site` under `foxtamings-projects`,
and both `ninefall.app` and `www.ninefall.app` are already attached to it. The only
thing left is four records in the OVH DNS zone.

Live right now at **https://ninefall-site.vercel.app**

## What OVH currently serves

| Record | Name | Value | What to do |
|---|---|---|---|
| A | `ninefall.app` | `188.165.6.20` | **change** to `76.76.21.21` |
| AAAA | `ninefall.app` | `2001:41d0:301:3::21` | **delete** |
| A | `www` | `188.165.6.20` | **delete** |
| AAAA | `www` | `2001:41d0:301:3::21` | **delete** |
| — | `www` | — | **add** CNAME to `cname.vercel-dns.com.` |
| MX | `ninefall.app` | `mx1/2/3.mail.ovh.net` | **leave alone** (your email) |
| TXT | `ninefall.app` | `v=spf1 include:mx.ovh.com -all` | **leave alone** (your email) |
| TXT | `ninefall.app` | `1\|www.ninefall.app` | delete (OVH parking marker) |

Both IPv6 records must go. Vercel publishes no AAAA for an apex, so if one is left
behind every visitor on IPv6 keeps landing on the OVH "Site under construction" page
while IPv4 visitors see the real site, which is a confusing way to find out.

## Steps in the OVH manager

1. Go to **ovh.com/manager** → **Web Cloud** → **Domain names** → **ninefall.app**.
2. Open the **DNS zone** tab.
3. Find the **A** record whose name is the bare domain and click the pencil. Replace
   `188.165.6.20` with `76.76.21.21`. Confirm.
4. Find the **AAAA** record for the bare domain and delete it.
5. Delete the **A** and **AAAA** records for `www`.
6. **Add an entry** → **CNAME**, subdomain `www`, target `cname.vercel-dns.com.`
   (keep the trailing dot). Confirm.
7. Delete the `1|www.ninefall.app` **TXT** record if it is still there.
8. If **Redirection** in the left menu shows a redirect for the domain or for `www`,
   remove it. It will fight the DNS otherwise.
9. Do not touch the MX records or the SPF TXT record. That is your mail, and
   `contact@ninefall.app` is now live on it. Deleting or editing either one
   silently stops mail to that address, which is the one printed on the privacy,
   support and press pages and inside the press kit.

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
