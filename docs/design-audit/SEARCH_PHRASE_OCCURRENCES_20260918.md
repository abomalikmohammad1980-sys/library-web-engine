# Selective phrase occurrence repair

The existing environment suite reproduced three failures: the optional local
probe assertion still expected700ms instead of the implemented2,000ms; the
ignored-Range fixture did not recognize the archive URL's verification query;
and selective phrase search returned one hit when a paragraph contained two
occurrences. The first two were stale test fixtures. The third was a real bug.

The selective snippet scan now keeps every matching start and its original
display-text offset, preserving numeric footnote-marker tolerance. Sorting uses
the offset as a tie breaker. Tests verify two distinct offsets and page1/page2
with one result per page, including repeated Arabic text, diacritics and
overlapping phrases. Sixteen initial and36 focused integration tests passed.

This repair does not close the separate global-posting occurrence-identity
characterization: that fallback still duplicates first-position hits, and its
existing diagnostic test explicitly records that limitation. Nor does it prove
complete snippets beyond their legacy truncation boundary or search speed.

Batch44 is prepared as a safe client-only follow-up to live batch41, keeping
all frozen data and Functions. It deliberately does not activate the incomplete
source-range overlay. Field metadata upload and independent fresh verification
continue separately. No live publication is claimed by this document alone.
