# 教師節 A2 華語文化課

An interactive lesson adapted from the teacher-provided **1教師節 for A2.docx**.

- Student site: https://ij-teacher.github.io/Teachers-Day-A2-/
- Teacher records: https://ij-teacher.github.io/Teachers-Day-A2-/teacher.html
- Printable QR page: https://ij-teacher.github.io/Teachers-Day-A2-/share.html

## Lesson

Six reading paragraphs, ten vocabulary words with pinyin and examples, three grammar patterns, reading comprehension, vocabulary practice, ten classroom scenarios, five sentence-order activities, and three student-written sentences. The original Word document is available in `materials/teachers-day-a2.docx`. `materials/lesson.md` contains extracted text. The original lesson's historical statements are preserved; comprehension questions explicitly refer to the reading.

## Student records

Students identify themselves by student ID only. IDs are self-reported, not school-account authentication. The record service saves successful entries, activity completion timestamps, latest activity scores for each visit, and three written sentences. No names or email addresses are requested. A completion means the activity was submitted, not that every answer was correct.

GitHub Pages hosts the public lesson and files. A separately deployed Sites service stores records in a private D1 database. Records and teacher credentials are never committed to this public repository. The teacher dashboard requires a secret access code, checks authorization on the server, displays Taiwan time, supports ID/date filters, and exports CSV. The access code is provided separately to the teacher.

The `config.js` file contains only public service addresses. Reloading or starting again creates a new visit; retrying a failed submission within the same visit does not duplicate completion records. The service limits a student ID to 30 new visits per hour. Sessions expire after 24 hours. Unsent answers remain in the current page only.

## Publishing

In repository **Settings → Pages**, select **GitHub Actions** as the source. The included workflow publishes the public files and original materials. It can also be run manually from the Actions tab. No server secrets are required for the Pages build.

The `record-service/` folder is an archival copy of the server source, schema, and migrations. It is excluded from the Pages artifact. Changes there do not automatically redeploy the record service.

## Teacher use

Share the student URL or QR code. Keep the teacher access code private. Open `teacher.html`, enter the code, and use the date or full student-ID filter. Each row represents one visit. Expand its details to see completion times and the student's sentences. Export CSV for your class records.

Optional read-aloud uses the browser's speech synthesis and available Chinese voice. It is not a recorded audio file.
