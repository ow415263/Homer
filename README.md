# Homer

Prototype of the Homer smart postcard experience. Built with vanilla HTML, CSS, and JavaScript so you can iterate quickly without committing to a framework.

## Getting started

Open `index.html` in your browser or serve the folder with any static file server:

```
npx serve .
```

## Features

- Sender flow to attach media links, configure authentication, and embed the postcard payload with a mail-it checklist.
- Upload-first media support with an attach modal that gathers photos, videos, or external links alongside a dedicated postcard message.
- Receiver flow that mirrors the NFC tap experience, including password-gated unlocks.
- Lightweight carousel for images, videos, or external links with quick download shortcuts and optional full-screen viewing.
- Local storage persistence to simulate writing to and reading from the physical postcard tag.
