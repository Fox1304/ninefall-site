# ninefall-site: gh-pages

This branch exists only to redirect the old GitHub Pages address to the real
site. The App Store listing for Ninefall 1.1 still points at
`https://fox1304.github.io/ninefall-site/` and its `#privacy` / `#support`
anchors, and those URLs cannot be changed until a new App Store version is
created, so they have to keep working.

`main` is the actual site and is deployed to https://ninefall.app by Vercel.
It uses absolute asset paths, so it cannot be served from a `/ninefall-site/`
subpath. Do not point GitHub Pages back at `main`.
