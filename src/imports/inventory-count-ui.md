Design a responsive inventory counting interface that works on mobile and desktop web. The main workflow is: Scan → Count → Save → Next item. Create two frames:

Mobile (390×844)

Desktop Web (1440×900)

Core Requirements (both views)

Two primary actions: Scan and Count / Save Count (large, obvious).

Scan opens a barcode scanning UI (camera preview area or modal). Provide fallback manual barcode input with a “Find” button.

After scanning/finding, show an Item Details Card with:

Product Name (bold)

SKU

Barcode

Show a Physical Count numeric input (large). Only allow values 0 and above.

Count/Save button is disabled until an item is selected and count is valid.

On save, show toast/snackbar: “Saved”, then clear the item card to allow scanning the next item quickly.

Include a Recent Counts section showing the last 5 entries (Product Name, SKU, Count).

Error states:

“Barcode not recognized. Try again.”

“No product found for this barcode.”

“Please enter a count.”

“Count cannot be negative.”

Mobile Layout (390×844)

Single-column layout, minimal scrolling.

Top header: Count Items + small subtitle Scan and enter physical count.

Large full-width buttons for Scan and Count/Save.

Item Details card appears after scan; count input below it.

Recent Counts list at the bottom (compact).

Desktop Web Layout (1440×900)

Two-column layout:

Left/Main panel (center-left): Scan + Item Details + Count input + Save

Right panel: Recent Counts (persistent, scrollable)

Keep main workflow components large and clear (not tiny).

Use whitespace; align content to feel like a professional web dashboard.

Style / UX

Warehouse-friendly: high contrast, large tap targets (48px+), simple typography.

Buttons should be prominent; use clear hierarchy.

Use clean cards, subtle borders, and consistent spacing.

Prioritize speed and clarity over extra features.