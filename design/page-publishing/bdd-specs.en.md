# Media Clean Page Publishing BDD Specs

[中文版本](./bdd-specs.md)

## Scenario 1: Chinese page is the default entry

```gherkin
Scenario: Chinese page is the default publishing entry
  Given the user opens the Media Clean publishing root path
  When the page finishes loading
  Then the user sees Chinese hero, phone preview, video intro, highlights, capabilities, gallery, and CTA sections
  And the page loads the required video, image, and icon resources
```

## Scenario 2: Legacy entry resolves to the confirmed page

```gherkin
Scenario: landing.html compatibility entry points to the Chinese main page
  Given the user opens /landing.html
  When the page finishes loading
  Then the user sees the same confirmed Chinese page as the root path
```

## Scenario 3: Vercel can build the page independently

```gherkin
Scenario: page directory builds independently
  Given the Vercel Root Directory is page
  When npm run build is executed
  Then dist contains index.html, promo-video-60fps.mp4, resources, apps/icons, robots.txt, and sitemap.xml
```

## Scenario 4: Android splash uses the latest resource

```gherkin
Scenario: Android native launch screen uses preview-frames splash
  Given the Android 9:16 splash has been copied to assets and native drawable
  When the Android app cold-starts
  Then the launch screen shows the Media Clean branded splash
```
