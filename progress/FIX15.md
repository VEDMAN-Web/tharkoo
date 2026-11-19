# H15.15 (FIX-15): All ads tick boxes and bulk usable on a phone (E1-C6)

Branch haiku/h15.15-allads-bulk-phone, ownership H15.15.json, off main 948f60a.

On a phone the kit hid every table tick box (`admin-kit.css` line 305), so on All ads at 390 px nobody could pick rows or reach the bulk bar (Pause, Move, Remove...). Now `ServerTable` has a `phoneSelect` prop (off by default, so the other tables and the kit gallery are unchanged) and All ads turns it on: each card gets a 44 px tick box in its corner (a drawn box with a white tick, keyboard focus ring kept), the row keeps room for it, and the bulk bar buttons are at least 44 px high on a phone.

Test first: `tests/e2e/fix15-allads-bulk-phone.e2e.ts` (phone) failed on a build without the change (the tick box was hidden); it checks every row box is visible and at least 44 x 44 inside the screen, ticks two rows, the bulk buttons are 44 px high, Pause with Undo works, and Remove... asks first and Cancel leaves the ad alone.
