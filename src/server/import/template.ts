/** Columns of the partner import CSV. Category field keys (for example "amount") are added as more columns. */
export const IMPORT_TEMPLATE_HEADERS = ["category", "subcategory", "city", "district", "title", "description", "price", "photos"] as const;

const EXAMPLE_ROWS = [
  ["cycles", "", "surat", "adajan", "Hero road cycle", "Well kept road cycle, serviced in March", "4500", "hero-cycle_01.jpg|hero-cycle_02.jpg"],
  ["cycles", "", "surat", "", "Kids cycle red", "Red cycle for ages 6 to 9", "1800", "https://res.cloudinary.com/demo/image/upload/tharkoo/listings/kids-cycle.jpg"],
];

export const IMPORT_HELP_LINES = [
  "One row is one ad. Required: category, city, title, description.",
  "category and subcategory are the slugs shown on the category page (subcategory may stay empty). city and district are slugs such as surat and adajan.",
  "price is a whole number of rupees, or leave it empty.",
  "photos: list the file names of the images you choose, separated by |, for example flat1-a.jpg|flat1-b.jpg. A link to an upload that is already on the site also works.",
  "Any image you choose that no row uses is listed in the check and is not uploaded.",
  "Category fields such as amount or condition are extra columns, named by their field key.",
  "Up to 500 rows per file. Check the file first: rows with a problem are shown and are not imported.",
];

function cell(value: string) {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** The downloadable template: every base column and two example rows. */
export function importTemplateCsv() {
  return [IMPORT_TEMPLATE_HEADERS.join(","), ...EXAMPLE_ROWS.map((row) => row.map(cell).join(","))].join("\r\n") + "\r\n";
}
