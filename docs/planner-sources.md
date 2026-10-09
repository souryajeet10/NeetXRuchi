# Chapter sources

Chapter names, ordering and lecture counts were transcribed from the six main user-provided Yakeen planners below. The PDFs themselves are not published in this repository. Dates in those 2025–2026 planners are not copied into the user's daily calendar.

| Planner | Chapters | Lectures |
| --- | ---: | ---: |
| Physics — Manish Raj | 31 | 218 |
| Physical Chemistry — Sudhanshu Kumar | 10 | 81 |
| Inorganic Chemistry — Kunwar Om Pandey | 6 | 57 |
| Organic Chemistry — Shubh Karan Choudhary | 10 | 81 |
| Botany — Vipin Sharma | 17 | 109 |
| Zoology — Samapti Sinha | 15 | 109 |
| **Main syllabus** | **89** | **655** |

The separate Physical Chemistry revision planner is intentionally excluded: this tracker contains chapters only.

Original filenames are recorded in `src/course-data.json`. Capitalization and spacing are lightly normalized; chapter boundaries follow the planners. Zoology's overlapping text in lecture 5 of Breathing and Exchange of Gases was checked visually: that chapter has eight lectures.

## Existing progress

All 71 old chapter IDs have explicit mappings in `src/legacy-chapters.json`. Renamed chapters and Botany-to-Zoology Biomolecules carry their progress and lecture records forward. Broad chapters split into multiple chapters carry their completion flags, dates and planning/test selections into each part. Users can adjust individual parts afterward.

Lecture numbers from a split chapter cannot be reliably allocated among its parts, so those parts start with their planner lecture totals and unmarked lectures. The previous records, including old plans and tests, remain in `state.legacyProgress` in the saved account data. Migration is idempotent, does not modify the incoming snapshot, and does not overwrite explicitly saved new chapter completion values. Existing custom lecture totals are retained for one-to-one chapter matches. The new syllabus is saved to Firebase on the next user change.
