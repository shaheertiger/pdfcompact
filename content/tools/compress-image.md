---
title: "Compress Image Free — Shrink to 20 KB, 50 KB or 100 KB"
description: "Compress JPG, PNG and WebP to an exact size in KB or by quality. Batch files, compare before and after, strip GPS data. Runs in your browser, nothing uploaded."
h1: "Compress Image — Get a Photo Under 20 KB, 100 KB or 1 MB"
lead: "Drop your photos, pick a target size or a quality, download smaller files. Nothing leaves your device."
answer: "To compress an image to a size, add it, choose Target size and pick 20 KB, 50 KB, 100 KB, 200 KB, 500 KB, 1 MB or your own number. The tool keeps the highest quality that fits and only reduces the pixel size when it must. In our tests a 12-megapixel, 2 MB phone photo reached 100 KB at about 1150 px and 65% quality. Nothing is uploaded."
keywords: ["compress image", "compress jpg", "reduce image size in kb", "compress image to 20kb", "compress image to 50kb", "compress image to 100kb", "compress png", "image compressor"]
updated: 2026-11-12
related: [resize-image, heic-to-jpg, jpg-to-pdf, compress-pdf]
faq:
  - q: "How do I compress a photo to under 50 KB?"
    a: "Choose Target size, tap 50 KB and press Compress. The tool tries qualities from 92% down to 40%, and if the photo is still too big it reduces the pixel size step by step until the file is under 50 KB."
  - q: "Will compressing reduce the quality of my image?"
    a: "Yes, a little, because JPG and WebP compression throws away fine detail. At 70–80% quality most people can't tell the difference on screen; use the before-and-after slider and Zoom in to check before you download."
  - q: "Does the tool remove EXIF and GPS location data?"
    a: "Yes, whenever an image is re-saved. Camera model, date, serial numbers and GPS coordinates are not copied into the new file. If a file is already smaller than the result and the tool returns your original untouched, its metadata stays."
  - q: "Why didn't my PNG get much smaller?"
    a: "PNG is lossless, so re-saving it alone saves little. Pick a colour count (256 or fewer) to make it a palette PNG, or save it as WebP or JPG. Photos shrink far more as JPG or WebP; screenshots and logos do well as 256-colour PNG."
  - q: "Can I compress many images at once?"
    a: "Yes. Add as many as you like; each gets the same setting, and you download them together as one ZIP. Your device's memory is the practical limit: dozens of phone photos are fine on a laptop."
  - q: "What's the smallest size it can reach?"
    a: "Any target of 1 KB or more is accepted, but very small targets mean very small pictures: a 20 KB photo is roughly 400 pixels tall. If a target can't be met even at 16 pixels, the tool tells you and gives you the smallest version it made."
  - q: "Can I compress HEIC photos from my iPhone?"
    a: "Not directly. Convert them with [HEIC to JPG](/heic-to-jpg) first, then compress the JPGs here."
  - q: "Is it safe for ID photos and documents?"
    a: "Yes. The compression runs in your browser with the canvas engine built into it, so passport photos, ID scans and signatures never leave your phone or computer."
limits:
  - label: Price
    value: Free. No account, no watermark, no daily cap.
  - label: Where it runs
    value: In your browser. Images never leave your device.
  - label: Input
    value: JPG, PNG and WebP, one or many at a time. HEIC needs converting first.
  - label: Output
    value: Same format, JPG or WebP. One file, or a ZIP for a batch.
  - label: Target sizes
    value: 20 KB, 50 KB, 100 KB, 200 KB, 500 KB, 1 MB or any custom size in KB.
  - label: Typical result
    value: "Quality 75%: camera JPGs 59–75% smaller in our tests. WebP: 81–88% smaller."
  - label: Metadata
    value: EXIF and GPS location are removed from every re-saved image.
  - label: File size
    value: Your device's memory is the limit. Very large images (over about 16 megapixels) are scaled to fit browser canvas limits.
  - label: Offline
    value: Works offline once the page has loaded.
howto:
  question: "How do I compress an image to a specific size in KB?"
  steps:
    - name: "Add your images"
      text: "Drop JPG, PNG or WebP files on the box, or tap it to choose from your gallery or files."
    - name: "Choose Target size and pick a size"
      text: "Tap 20 KB, 50 KB, 100 KB, 200 KB, 500 KB or 1 MB, or Custom to type the exact limit your form asks for."
    - name: "Check the format — this is the step people miss"
      text: "Same format keeps a PNG as a PNG, which compresses poorly. If the form accepts JPG, pick JPG for photos and signatures."
    - name: "Compress and compare"
      text: "Press Compress, then drag the before-and-after slider and use Zoom in to check faces and text."
    - name: "Download"
      text: "Download the single file, or the ZIP for a batch. Your originals are untouched."
---

## How do I reduce a photo's size in KB without losing quality?

Every JPG and WebP compressor trades detail for bytes, so "without losing quality" really means "without losing quality you can see". Two things decide how far you can go: the quality setting and the pixel size. This tool tries quality first, from 92% down to 40%, because lower quality is invisible at first. Only when that isn't enough does it reduce the width and height, aiming for about 60–70% quality at the smaller size, which looks cleaner than a full-size photo crushed to 10%.

Use the slider under the result to compare the original and the compressed image side by side, and press Zoom in to look at eyes, hair and small text. If you can see blocky patches, choose a larger target or a higher quality.

## Compress JPG, PNG or WebP: which format should I pick?

| What you have | Best choice | Measured on our test images |
| --- | --- | --- |
| Phone or camera photo (JPG) | JPG at 70–80% | 59–75% smaller at 75% quality |
| Same photo, website or chat | WebP at 75% | 81–88% smaller, same pixel size |
| Photo saved as PNG | JPG or WebP | 89–95% smaller as JPG, 92–97% as WebP |
| Screenshot, logo, diagram (PNG) | PNG, 256 colours | 48–83% smaller, transparency kept |
| Already small grayscale PNG | Leave it | No gain; the original is kept |

PNG is lossless, so a canvas re-save barely changes its size. Choosing a colour count (256, 128, 64 or 32) turns it into a palette PNG, the same idea TinyPNG uses: sharp for flat graphics, but photos show banding. WebP keeps transparency; JPG fills transparent areas with white.

## Can I compress images to an exact size like 20 KB or 100 KB?

Yes, that's what Target size does. It encodes the image several times, binary-searching the quality until the file is as close under your limit as it can get. Measured results on 12-megapixel, 2 MB phone photos:

| Target | Result size | Pixel size | Quality |
| --- | --- | --- | --- |
| 1 MB | 947–1000 KB | full 4032×3024 | 77–81% |
| 200 KB | 198–200 KB | about 1650–1950 px long side | 65–73% |
| 100 KB | 99–100 KB | about 1060–1540 px long side | 64–69% |
| 20 KB | 20 KB | about 370×490 | about 68% |

Photos with less fine detail (skies, studio shots) keep more pixels at the same size; noisy low-light photos keep fewer.

## Where size limits come from

These are the limits people most often compress for. Rules change, so treat these as what applied at the time of writing and check the site you're uploading to.

### Email attachments (Gmail 25 MB, Outlook 20 MB)

Gmail accepts 25 MB of attachments per email and turns anything larger into a Drive link; Outlook.com stops at 20 MB. A dozen phone photos can pass that. Target 500 KB or 1 MB per photo keeps them sharp on screen and lets 20 or more fit in one message.

### Instagram posts and stories

Instagram shows feed photos at up to 1080 pixels wide and re-compresses everything you upload, so a 6 MB original gains nothing. Size the photo first with [Resize Image](/resize-image) (1080×1080 square, 1080×1350 portrait, 1080×1920 story), then compress at 85–90% quality to keep control of how it looks.

### Discord (10 MB for free accounts)

At the time of writing, Discord's upload limit for users without Nitro is 10 MB per file. Most phone photos fit already; screenshots of a 4K screen saved as PNG may not. Save those as WebP or JPG and they drop to a few hundred KB.

### WhatsApp

WhatsApp compresses photos you send as photos, which is why they arrive soft. Sending as a document keeps the file as it is. If the other person is on slow data, compress to 200–500 KB first so the document arrives quickly and still looks good.

### US visa photo (DS-160): JPEG up to 240 KB

The US State Department's digital photo rules for the DS-160 ask for a square JPEG of at least 600×600 and at most 1200×1200 pixels, 240 KB or smaller. Crop and size it to 600×600 with the Passport preset in [Resize Image](/resize-image), then compress with Custom set to 230 KB for a safety margin. Check the result is still 600×600 before uploading.

### Indian exam and government forms (photo under 50 KB, signature under 20 KB)

Many Indian exam and government application forms ask for a photo under 50 KB and a signature under 20 KB, often in JPG, sometimes with a minimum size too (for example 10 KB). Check the form's exact rule: pixel dimensions and a minimum file size are often given. Choose JPG, then 50 KB or 20 KB; for a minimum, use Custom with a number just under the maximum.

### Job portals and application forms

Applicant tracking systems and university portals often cap profile photos and scanned certificates at 1–5 MB, sometimes 500 KB. A 200 KB or 500 KB target meets almost all of them. For scanned documents that must be one PDF, combine them with [JPG to PDF](/jpg-to-pdf).

### Website speed

Large images are the usual reason a page loads slowly. For a blog or shop, limit the longest side to 1920 or 1280 pixels in the optional pixel-size setting and save as WebP at 75–80%: a 2 MB photo typically lands around 150–400 KB.

## Troubleshooting

| Problem | Fix | Why it happens |
| --- | --- | --- |
| The result is "no smaller" | Lower the quality, choose WebP, or set a target. | The file was already well compressed; the tool keeps the original rather than make it bigger. |
| Image looks blocky or blurry | Use a bigger target or 75%+ quality, and zoom in to compare. | Very small targets force low quality or fewer pixels. |
| "Couldn't get under" the target | Accept the smallest version, or crop the image first. | Some targets are too small for any useful picture. |
| PNG barely shrank | Pick 256 colours, or save as WebP or JPG. | PNG is lossless; re-saving it alone saves little. |
| Transparent background turned white | Save as WebP or keep PNG. | JPG has no transparency. |
| HEIC file rejected | Convert it with HEIC to JPG first. | Most browsers can't decode HEIC directly. |
| Browser tab crashes on a phone | Compress fewer photos at a time. | Mobile browsers give each tab limited memory. |
