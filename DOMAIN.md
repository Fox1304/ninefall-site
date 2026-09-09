# ninefall.app on Vercel, with OVH keeping the DNS

**The domain is live and canonical on the apex.** `https://ninefall.app` serves the
Vercel project `ninefall-site` (team `foxtamings-projects`) over a valid certificate,
and `www.ninefall.app` returns a path-preserving `308` to it.

Verified 8 September 2026 against `ns111.ovh.net` and against Vercel directly.

## The records that make it work

| Record | Name | Value |
|---|---|---|
| A | `@` | `216.198.79.1` |
| A | `www` | `216.198.79.1` |

No `AAAA` on either name — that is deliberate. A stale OVH IPv6 address was once the
reason `www` kept serving OVH's "Site under construction" page long after IPv4 had
moved, because browsers prefer IPv6.

`216.198.79.1` is Vercel's current apex address. The zone previously used
`76.76.21.21`, which still resolves and still serves the site, so the two coexisted
harmlessly while resolvers caught up.

`www` is an A record rather than a `CNAME` to `cname.vercel-dns.com.`. That works,
and it is what `vercel domains inspect` recommended for this project — though note
that recommendation predates the IP change and has not been re-run since. The cost
of the A record is that another Vercel address change means another manual edit; a
CNAME would follow on its own.

The `www` → apex redirect is a **Vercel** setting, not DNS: *Project → Settings →
Domains*, `www.ninefall.app` set to redirect to `ninefall.app`. The apex has to stay
canonical because the App Clip association (`appclips:ninefall.app`) and every shared
board link (`https://ninefall.app/p/...`) are bound to the bare domain.

Everything else in the zone is mail or delegation and must be left exactly as it is —
it is what carries `contact@ninefall.app`:

- the three `MX` records (`mx1`/`mx2`/`mx3.mail.ovh.net.`)
- the `SPF` row, `v=spf1 include:mx.ovh.com -all` (OVH's UI calls it a distinct
  type; it is published as a normal `TXT` record, which is correct)
- the `_autodiscover._tcp`, `_imaps._tcp` and `_submission._tcp` `SRV` records
- the `autoconfig`, `autodiscover`, `imap`, `mail`, `pop3` and `smtp` `CNAME`s
- the two `NS` records (`ns111` / `dns111.ovh.net.`)

## Outstanding

### Mail authentication — neither is published yet

SPF is present and correct. DKIM and DMARC are not, so mail from
`contact@ninefall.app` is more likely to be filtered.

`_dmarc.ninefall.app` returns nothing from the authoritative nameserver. Add:

```
_dmarc  TXT  "v=DMARC1; p=none; rua=mailto:contact@ninefall.app"
```

Start at `p=none` and read the reports for a few weeks before tightening to
`quarantine` or `reject`. Tightening before DKIM is live will cause rejections.

For DKIM, check whether the OVH email panel shows it as active or still provisioning.
A probe of the ten usual selectors — `ovhdkim`, `ovhdkim1`, `ovhdkim2`, `selector1`,
`selector2`, `default`, `mail`, `ovh`, `dkim`, `k1` — found nothing on 8 September
2026. A custom selector would not have been caught by that probe.

Note that the SPF record ends in `-all`, a hard fail. That is fine while OVH is the
only thing sending mail for the domain. If a transactional sender is ever added for
the beta list, its `include:` has to go into the SPF record first or the mail bounces.

### CAA — optional, and deliberately skipped

There is no `CAA` record, so any CA may issue for the domain. Adding one is real
hardening, but getting it wrong breaks Vercel's certificate renewals quietly. Leave
it alone unless you want to think carefully about which issuers to allow.

## Two traps worth remembering

### The Redirection page is not a list of redirects

Despite the name, OVH's **Redirection** page renders the zone's A and CNAME records.
`ninefall.app` and `www.ninefall.app` appear on it as `vers un serveur (ipv4 - A)`,
and the mail names as CNAMEs to `ssl0.ovh.net` and `mailconfig.ovh.net`. Deleting a
row there deletes the underlying DNS record — removing either of the first two takes
the site down.

A genuine web redirect carries a different Type, worded like *vers une adresse web*,
*redirection visible* or *invisible*. None was present when the page was checked.

### When the site looks broken but isn't

If the domain shows OVH's "Site under construction" page from one machine while it
works everywhere else, it is a stale local resolver cache holding pre-migration OVH
addresses (`188.165.6.20`, `2001:41d0:301:3::21`). This has already cost time once.

```bash
sudo dscacheutil -flushcache && sudo killall -HUP mDNSResponder
```

Browsers cache separately — quit them fully or use a private window.

To tell a local problem apart from a real one, ask a public resolver, then bypass DNS
entirely and talk to Vercel. If the second command works, the zone is fine and the
problem is local:

```bash
dig +short ninefall.app A @1.1.1.1
curl -sI --resolve ninefall.app:443:216.198.79.1 https://ninefall.app/ | head -1
```

`server: Vercel` in the headers means you reached Vercel; `server: Apache` means you
reached OVH. OVH's TTL is one hour, so allow that long after any zone edit before
treating a disagreement between resolvers as a fault.

`.app` is on the HSTS preload list and is HTTPS-only by design. During any future
certificate gap the domain looks broken rather than insecure. That is expected and
resolves itself.

## Still to do outside this repo

Neither is verified from here — the Ninefall app repo is not checked out alongside
this one, so treat them as open until confirmed.

- **App Store metadata** in `ios/fastlane/metadata/`. All three URLs were last known
  to point at `fox1304.github.io/ninefall-site`: `marketing_url.txt` →
  `https://ninefall.app/`, `support_url.txt` → `https://ninefall.app/support`,
  `privacy_url.txt` → `https://ninefall.app/privacy`. Same for the eight other
  locales.
- **Universal links** need `applinks:ninefall.app` in
  `ios/Ninefall/Ninefall.entitlements`. Only the App Clip declared an associated
  domain, so `/p/` links open the App Clip or the website rather than the installed
  app until a build ships with that entitlement.
