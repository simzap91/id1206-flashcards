# ID1206 study practice

120 flashcards and 74 quiz questions for the supplied ID1206 operating-systems materials. Open `index.html` directly in a browser; there is no installation or build step. Keep the JavaScript and CSS files beside it. Any ordinary static host can serve the repository as well.

Flashcards and quizzes have independent shuffled rounds. Filter by topic and foundation/application level. Quizzes can mix types or show only single-answer or multiple-answer questions. Multiple-answer scoring requires the exact correct set, with no partial credit. Checking or skipping reveals the answer and explanation; completing the round shows results by topic and lets you retry incorrect or skipped questions. Switching mode preserves the current round; changing filters starts a new round. Progress is kept in memory and resets on reload.

## Content and sources

The question bank covers OS fundamentals, processes, IPC, CPU scheduling, main memory, virtual memory, demand paging, and threads/parallelism. Every entry includes a lecture filename and one-based PDF page references, shown after revealing/submitting the answer. `study-data.js` holds all content separately from UI and scoring logic.

The seven supplied lecture PDFs substantiate the questions. The two compilation PDFs were checked for overlapping study context. The thirteen supplied PNGs show Canvas-style quiz questions on processes, threads, and scheduling; these guided the mix of recall, multiple selection, arithmetic and code tracing. No separately named example-exam files were present in the folder at the time of authoring. The bank intentionally stays within the supplied lecture topics rather than extending to a complete exam syllabus.

Application questions use fresh values with explicit assumptions (for example, no I/O or switching cost). They are derived exercises, not claimed copies of exam questions. The source PDFs/images are not bundled into this repository.

Clarifications applied while authoring:

- `exec` replaces the program image in an existing process; it does not itself create another process.
- General PCB terminology is distinguished from Linux's `task_struct` name.
- Nonresident pages and illegal addresses are distinguished; a TLB miss alone is not a page fault.
- TLB arithmetic explicitly says whether only translation latency is being measured.
- Multiple-level queue movement is described as feedback behavior, avoiding ambiguous screenshot wording.
- Thread joins wait for completion; they do not make earlier concurrent increments atomic or automatically free arbitrary application heap allocations. C data races have undefined behavior.
- EEVDF questions are phrased as the supplied lecture's explanation rather than a claim about every deployed Linux system.

## Validation

Run the dependency-free data and scoring checks with:

```sh
node --test tests/study.test.js
```

`tests/browser-check.cjs` is an optional browser integration check using Playwright from the local runtime. Set `PLAYWRIGHT_MODULE` to the installed Playwright module path if it is not installed in the checkout. It checks file-based loading, filters, radio/checkbox behavior, shuffled answer mapping, exact-set scoring, duplicate submission protection, summaries, retry, mode state, keyboard controls, and mobile overflow.
