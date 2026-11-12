---
title: "Protect PDF Free — AES-256 Password Lock, No Upload"
description: "Lock a PDF with an AES-256 password in your browser. Optionally block printing, copying or editing. Self-checked before download, nothing uploaded."
h1: "Protect PDF — Add a Password to a PDF"
lead: "Drop a PDF, type a password twice, download a copy that won't open without it."
answer: "To password-protect a PDF, drop the file, type an open password twice and press Protect PDF. The copy is encrypted with AES-256, the strongest standard PDF encryption, and the tool checks it refuses to open without the password before you download it. You can also block printing, copying or editing. It runs in your browser and took 1 to 2 seconds per file in our tests."
keywords: ["protect pdf", "password protect pdf", "encrypt pdf", "lock pdf", "add password to pdf"]
updated: 2026-11-12
related: [watermark-pdf, flatten-pdf, compress-pdf, sign-pdf]
faq:
  - q: "How strong is the encryption?"
    a: "It's AES-256, the PDF 2.0 standard security handler (revision 6), the strongest encryption the PDF format defines. In practice the password is the weak point: a long, unusual password is what keeps the file safe."
  - q: "Can you recover my password if I forget it?"
    a: "No. The password never leaves your device and we never see the file, so nobody, including us, can recover it. Keep the unprotected original or store the password in a password manager."
  - q: "Will the protected PDF open on iPhone, Android and Mac?"
    a: "Yes, in current readers. AES-256 is supported by Adobe Acrobat and Reader X or later, Chrome, Edge, Firefox, macOS Preview and current phone PDF apps. Readers older than about 2010 can't open it."
  - q: "What's the difference between the open password and the permissions password?"
    a: "The open password is needed to view the file. The optional permissions password lets its holder lift restrictions on printing, copying and editing. Use two different passwords."
  - q: "Are the printing and copying restrictions unbreakable?"
    a: "No. Restrictions are honored by Adobe Reader, Chrome, Edge, Preview and most readers, but anyone who can open the file can find software that ignores them. The open password is the real protection."
  - q: "Does protecting a PDF make it bigger or change it?"
    a: "Barely. In our tests sizes changed by less than 2 KB on normal files. Pages, text, images and form fields are kept."
  - q: "Can I remove a password with this tool?"
    a: "No, this page only adds passwords. To remove one, open the file with its password in your PDF reader and save or print it to a new PDF."
  - q: "Is my file or password uploaded?"
    a: "No. Encryption happens in your browser. You can disconnect from the internet after the page loads and it still works."
limits:
  - label: Price
    value: Free. No account, no watermark.
  - label: Where it runs
    value: In your browser. The file and password never leave your device.
  - label: Encryption
    value: AES-256 (PDF standard security handler, revision 6).
  - label: Passwords
    value: An open password (at least 4 characters, typed twice) and an optional, different permissions password.
  - label: Restrictions
    value: Optional. Block printing, copying text and images, or editing, comments and form filling.
  - label: Speed
    value: 1.1 to 2 seconds per file in our tests, including the self-check.
  - label: File size
    value: Changes by a few KB at most.
  - label: Compatibility
    value: Current readers on Windows, Mac, iPhone and Android. Not readers from before about 2010.
  - label: Already encrypted files
    value: Files with only editing restrictions can be re-locked. Files that already need a password must be unlocked first.
howto:
  question: "How do I put a password on a PDF?"
  steps:
    - name: "Drop your PDF"
      text: "Drop the file above or tap to choose it. Nothing is uploaded."
    - name: "Type the open password twice"
      text: "The meter shows how hard it is to guess. Twelve or more characters, or three or four random words, is a good target."
    - name: "Add restrictions if you need them (optional)"
      text: "Tick Also restrict printing, copying or editing, untick what to block, and set a different permissions password."
    - name: "Protect and download"
      text: "Press Protect PDF. The tool re-opens the result to confirm it refuses to open without the password, then offers the download."
    - name: "Send the password separately"
      text: "Text it or say it on the phone rather than putting it in the same email as the file. This is the step people skip."
---

## How do I password-protect a PDF without Adobe Acrobat?

Use this page. Adding a password in Acrobat needs a paid Acrobat plan, and many free websites upload your file to their server to encrypt it, which defeats the point for a document private enough to need a password. Here the encryption runs in your browser: the PDF is read on your device, encrypted with AES-256, checked, and handed back as a download. The password exists only in this browser tab.

On a Mac, Preview can also add a password from File, Export (the option is called Encrypt or Permissions, depending on your macOS version). On Windows there is no built-in way; Microsoft Word can export a password-protected PDF only from a Word document, not lock an existing PDF.

## How strong is PDF password protection?

The encryption itself is very strong. AES-256 is the cipher the PDF 2.0 standard recommends, and nobody can open the file by attacking the cipher. What can be attacked is the password: someone with the file can try millions of guesses. That's why the length of your password matters far more than anything else.

| Password | Example | How it holds up |
| --- | --- | --- |
| Date of birth | 15081990 | Guessable in seconds; there are only about 36,500 dates in a century |
| One word with a number | Sunshine1 | Weak; found quickly by common-password lists |
| 8 random characters | k7#Rq2!m | Fair for casual use |
| 12+ random characters | Tq8-vLw3-Zp9x | Strong |
| 4 random words | cactus-ferry-violet-drum | Strong and easy to say on the phone |

Many banks and employers send payslips and statements locked with a date of birth or part of an account number. That keeps the file closed if an email goes to the wrong person, but it isn't real secrecy. For your own documents, use a longer password.

## Do printing and copying restrictions really work?

Partly. When you tick **Also restrict printing, copying or editing**, the PDF carries flags that tell readers what to allow. Adobe Reader, Chrome, Edge and Preview honor them: the Print button is greyed out or text can't be selected. But the file is still readable by anyone with the open password, and some programs ignore the flags (Firefox's built-in viewer does by default). Treat restrictions as a clear "please don't" for honest recipients, not as a lock. The open password is what actually keeps strangers out.

If you need a document that can't be edited easily, combine steps: [Flatten PDF](/flatten-pdf) with Flatten everything turns pages into images, [Watermark PDF](/watermark-pdf) marks it as yours, and this page adds the password.

## When people protect PDFs

### Payslips and salary statements

Before emailing a payslip to a landlord, a mortgage broker or a visa agent, lock it and send the password by text. If the email is forwarded or the inbox is ever compromised, the attachment stays closed.

### Tax returns

A completed tax return, such as a US Form 1040 or an Indian ITR acknowledgement, contains your tax ID, income and address. Protect it before sending it to an accountant who asked for it by email rather than through a secure portal.

### Medical records and test results

Lab reports, prescriptions and discharge summaries often need to go to a new doctor, an insurer or a family member. A password keeps them private in shared family inboxes and on phones that get passed around.

### Scanned ID documents

Passport and driving licence scans are a favorite target for identity fraud. If an organization insists on receiving them by email, lock the PDF and send the password separately.

### Contracts before signature

Lock a draft contract and turn off editing so the other side reads exactly what you sent. They can still comment if you leave that allowed, or you can [sign the PDF](/sign-pdf) first.

## Troubleshooting

| Problem | Fix | Why |
| --- | --- | --- |
| The Protect PDF button stays grey | Type the same password in both boxes, at least 4 characters. If restrictions are on, set a different permissions password. | The tool won't create a file you might not be able to open. |
| "This PDF already needs a password to open" | Open it with that password, save an unprotected copy, then protect the copy. | A file can't be re-encrypted without first being decrypted. |
| The recipient's old software can't open it | Ask them to use a current reader such as Adobe Reader, Chrome or Edge. | AES-256 needs a reader from about 2010 or later. |
| The recipient can still print | They may be using an app that ignores restrictions. | Restrictions are flags that readers choose to honor. |
| I forgot the password | Use your original, unprotected file and protect it again. | Strong encryption has no back door, by design. |
| An email service blocked the attachment | Share the file through a cloud link instead, with the password sent separately. | Some mail filters reject encrypted attachments they can't scan. |
