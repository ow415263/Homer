# Homer

Prototype of the Homer smart postcard experience. Built with vanilla HTML, CSS, and JavaScript so you can iterate quickly without committing to a framework.

## Getting started

Open `index.html` in your browser or serve the folder with any static file server:

```
npx serve .
```

The dashboard experience now lives on `dashboard.html`. Once the static server is running, navigate to `/dashboard.html` (or use the dashboard icon in the header) to see profile stats, run instructions, and upcoming features.

## Features

- Sender flow to attach media links, configure authentication, and embed the postcard payload with a mail-it checklist.
- Upload-first media support with an attach modal that gathers photos, videos, or external links alongside a dedicated postcard message.
- Receiver flow that mirrors the NFC tap experience, including password-gated unlocks.
- Lightweight carousel for images, videos, or external links with quick download shortcuts and optional full-screen viewing.
- Local storage persistence to simulate writing to and reading from the physical postcard tag.

## Location extraction & map view

- The sender modal now offers a required opt-in for extracting safe location labels from photo metadata. When enabled, Homer reads EXIF GPS tags (via [exifr](https://github.com/MikeKovarik/exifr)) directly in the browser and stores latitude/longitude with each media item. If a file lacks GPS data, Homer falls back to hints in filenames, pasted links, or the typed location field.
- Receivers can open a dedicated Google Maps view to see geotagged media pinned on an interactive map. Hover or tap a pin to preview the attached photo and timestamp.
- To activate the live map, supply your own API key before loading the app. Add a config snippet anywhere before `src/main.js` loads (for example, in `index.html` just above the module script):

```html
<script>
	window.HOMER_CONFIG = {
		googleMapsApiKey: "YOUR_KEY_HERE",
		googleMapsMapId: "", // optional custom Map ID
	};
</script>
```

Without a key, the receiver map gracefully shows guidance so you can still test the rest of the flow locally.
