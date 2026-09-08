# ninefall.app on Vercel, with OVH keeping the DNS

**The domain is live.** `https://ninefall.app` and `https://www.ninefall.app` both
serve the Vercel project `ninefall-site` (team `foxtamings-projects`) over a valid
certificate. The DNS migration is finished; what is left below is cleanup and mail
hygiene, none of which affects whether the site loads.

Verified 8 September 2026 against the OVH authoritative servers and against
`1.1.1.1` / `8.8.8.8`.

## The zone as it should be, and is

These are the records that make the site work. Both are already correct — do not
touch them.

| Record | Name | Value |
|---|---|---|
| A | `@` | `76.76.21.21` |
| A | `www` | `76.76.21.21` |

There is no `AAAA` on either name, which is what we want: the old OVH IPv6 address
was the reason `www` kept serving OVH's "Site under construction" page long after
IPv4 had moved.

`www` is an A record rather than a `CNAME` to `cname.vercel-dns.com.`, which is what
`vercel domains inspect` recommends for this project. The only cost is that if Vercel
ever retires `76.76.21.21` the record has to be edited by hand.

Everything else in the zone is mail or delegation and must be left exactly as it is —
it is what carries `contact@ninefall.app`:

- the three `MX` records (`mx1`/`mx2`/`mx3.mail.ovh.net.`)
- the `SPF` row, `v=spf1 include:mx.ovh.com -all` (OVH's UI calls it a distinct
  type; it is published as a normal `TXT` record, which is correct)
- the `_autodiscover._tcp`, `_imaps._tcp` and `_submission._tcp` `SRV` records
- the `autoconfig`, `autodiscover`, `imap`, `mail`, `pop3` and `smtp` `CNAME`s
- the two `NS` records (`ns111` / `dns111.ovh.net.`)

## Cleanup still outstanding

Nothing here is breaking the site. In rough order of how much it matters.

### 1. `www` does not redirect to the apex

Both hostnames currently answer `200` with an identical etag, so the site is
canonical on two URLs at once. This is a **Vercel** setting, not DNS:
**Project → Settings → Domains**, set `www.ninefall.app` to **redirect to**
`ninefall.app`.

The apex has to win: the App Clip association (`appclips:ninefall.app`) and every
shared board link (`https://ninefall.app/p/...`) are bound to the bare domain.

### 2. Delete the OVH redirect marker

The zone still carries `TXT` on `@` with the value `1|www.ninefall.app`, which is
OVH's web-redirection marker. Nothing is regenerating it — the **Redirection** page
was checked on 8 September 2026 and holds no web redirect at all. Delete the record
and it stays deleted.

**Do not prune the Redirection page.** Despite the name it is a rendering of the
zone's A and CNAME records, not a list of HTTP redirects. `ninefall.app` and
`www.ninefall.app` both appear on it as `vers un serveur (ipv4 - A)` →
`76.76.21.21`, and the mail names appear as CNAMEs to `ssl0.ovh.net` and
`mailconfig.ovh.net`. Deleting a row there deletes the underlying DNS record;
removing either of the first two takes the site down.

A genuine web redirect would carry a different Type — wording along the lines of
*vers une adresse web*, *redirection visible* or *invisible*. That is the only kind
worth removing, and none was present.

### 3. Delete the `ftp` CNAME

`ftp CNAME ninefall.app.` now resolves to Vercel, which serves nothing for it. Pure
clutter from the OVH default zone.

### 4. Add DMARC, and turn on DKIM

SPF is present and correct, but there is no DKIM and no DMARC, so mail from
`contact@ninefall.app` is more likely to be filtered. Enable DKIM in the OVH email
panel (it adds its own selector records), then add:

```
_dmarc  TXT  "v=DMARC1; p=none; rua=mailto:contact@ninefall.app"
```

Start at `p=none` and read the reports for a few weeks before tightening to
`quarantine` or `reject`.

Note that the SPF record ends in `-all`, a hard fail. That is fine while OVH is the
only thing sending mail for the domain. If a transactional sender is ever added for
the beta list, its `include:` has to go in the SPF record first or the mail bounces.

### 5. CAA — optional

There is no `CAA` record, so any CA may issue for the domain. Adding one is real
hardening, but getting it wrong breaks Vercel's certificate renewals silently. Skip
it unless you want to think carefully about which issuers to allow.

## When the site looks broken but isn't

This is the failure mode that has already cost time once. If `ninefall.app` shows
OVH's "Site under construction" page from your Mac while it works elsewhere, it is
almost certainly a stale local resolver cache still holding the pre-migration OVH
addresses (`188.165.6.20` and `2001:41d0:301:3::21`).

```bash
sudo dscacheutil -flushcache && sudo killall -HUP mDNSResponder
```

Browsers cache separately — quit them fully or use a private window.

To tell a local cache problem apart from a real one, ask a public resolver, then
bypass DNS entirely and talk to Vercel directly. If the second command works, the
zone is fine and the problem is on your machine:

```bash
dig +short ninefall.app A @1.1.1.1
curl -sI --resolve ninefall.app:443:76.76.21.21 https://ninefall.app/ | head -1
```

A healthy response has `server: Vercel` in the headers. `server: Apache` means you
reached OVH.

Also worth knowing: `.app` is on the HSTS preload list, so it is HTTPS-only by
design. During any future certificate gap the domain looks broken rather than
insecure. That is expected and resolves itself.

## Still to do outside this repo

Neither of these is verified from here — the Ninefall app repo is not checked out
alongside this one, so treat them as open until confirmed.

- **App Store metadata** in `ios/fastlane/metadata/`. All three URLs were last known
  to point at `fox1304.github.io/ninefall-site`: `marketing_url.txt` →
  `https://ninefall.app/`, `support_url.txt` → `https://ninefall.app/support`,
  `privacy_url.txt` → `https://ninefall.app/privacy`. Same for the eight other
  locales.
- **Universal links** need `applinks:ninefall.app` in
  `ios/Ninefall/Ninefall.entitlements`. Only the App Clip declared an associated
  domain, so `/p/` links open the App Clip or the website rather than the installed
  app until a build ships with that entitlement.
